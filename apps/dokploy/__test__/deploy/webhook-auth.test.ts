import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import type { NextApiRequest } from "next";
import { describe, expect, it } from "vitest";
import {
	parseWebhookBody,
	readRawBody,
	verifyWebhookSignature,
	WEBHOOK_BODY_LIMIT_BYTES,
	WebhookBodyTooLargeError,
} from "@/server/utils/webhook-auth";

const secret = "app-webhook-token";
const raw = Buffer.from('{"ref":"refs/heads/main", "after":"abc"}');
const hmac = (key: string, body: Buffer) =>
	createHmac("sha256", key).update(body).digest("hex");

describe("verifyWebhookSignature", () => {
	it("accepts unsigned deliveries (the URL token authenticates them)", () => {
		expect(verifyWebhookSignature({}, raw, secret)).toBe("unsigned");
	});

	it("checks the GitLab secret token", () => {
		expect(
			verifyWebhookSignature({ "x-gitlab-token": secret }, raw, secret),
		).toBe("verified");
		expect(
			verifyWebhookSignature({ "x-gitlab-token": "guess" }, raw, secret),
		).toBe("invalid");
	});

	it("checks Gitea HMAC signatures over the raw bytes", () => {
		expect(
			verifyWebhookSignature(
				{ "x-gitea-signature": hmac(secret, raw) },
				raw,
				secret,
			),
		).toBe("verified");
		expect(
			verifyWebhookSignature(
				{ "x-gitea-signature": hmac("other", raw) },
				raw,
				secret,
			),
		).toBe("invalid");
	});

	it("checks GitHub and Bitbucket sha256= signatures", () => {
		const header = `sha256=${hmac(secret, raw)}`;
		expect(
			verifyWebhookSignature({ "x-hub-signature-256": header }, raw, secret),
		).toBe("verified");
		expect(
			verifyWebhookSignature({ "x-hub-signature": header }, raw, secret),
		).toBe("verified");
	});

	it("rejects a signature computed over re-serialized JSON", () => {
		const reserialized = Buffer.from(
			JSON.stringify(JSON.parse(raw.toString())),
		);
		const header = `sha256=${hmac(secret, reserialized)}`;
		expect(
			verifyWebhookSignature({ "x-hub-signature-256": header }, raw, secret),
		).toBe("invalid");
	});
});

describe("readRawBody / parseWebhookBody", () => {
	const request = (chunks: Buffer[]) =>
		Readable.from(chunks) as unknown as NextApiRequest;

	it("returns the exact bytes that were sent", async () => {
		expect(await readRawBody(request([raw]))).toEqual(raw);
	});

	it("rejects payloads above the limit", async () => {
		const big = Buffer.alloc(WEBHOOK_BODY_LIMIT_BYTES + 1);
		await expect(readRawBody(request([big]))).rejects.toBeInstanceOf(
			WebhookBodyTooLargeError,
		);
	});

	it("parses JSON and GitHub form-encoded payloads", () => {
		expect(parseWebhookBody(raw, "application/json")).toEqual({
			ref: "refs/heads/main",
			after: "abc",
		});
		const form = Buffer.from(`payload=${encodeURIComponent('{"zen":"ok"}')}`);
		expect(parseWebhookBody(form, "application/x-www-form-urlencoded")).toEqual(
			{ zen: "ok" },
		);
	});
});
