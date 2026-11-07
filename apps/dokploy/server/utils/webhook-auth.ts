import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { NextApiRequest } from "next";

export const WEBHOOK_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

export class WebhookBodyTooLargeError extends Error {}

/**
 * Reads the request body as raw bytes. Signatures are computed by the Git
 * host over the exact bytes it sent; verifying against a re-serialized
 * `JSON.stringify(req.body)` breaks on any whitespace or key-order change.
 */
export const readRawBody = async (req: NextApiRequest): Promise<Buffer> => {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > WEBHOOK_BODY_LIMIT_BYTES) {
			throw new WebhookBodyTooLargeError("Webhook payload too large");
		}
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
};

export const parseWebhookBody = (raw: Buffer, contentType?: string) => {
	if (raw.length === 0) return {};
	const text = raw.toString("utf8");
	if (contentType?.includes("application/x-www-form-urlencoded")) {
		// GitHub can send `payload=<json>` when configured for form encoding.
		const payload = new URLSearchParams(text).get("payload");
		return payload ? JSON.parse(payload) : {};
	}
	return JSON.parse(text);
};

const safeEqual = (a: string, b: string) => {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
};

const hmacHex = (secret: string, raw: Buffer) =>
	createHmac("sha256", secret).update(raw).digest("hex");

const header = (headers: IncomingHttpHeaders, name: string) => {
	const value = headers[name];
	return Array.isArray(value) ? value[0] : value;
};

export type SignatureResult = "verified" | "unsigned" | "invalid";

/**
 * Verifies whichever signature scheme the sender used, keyed on the
 * per-service webhook token. Unsigned deliveries are still accepted because
 * the token in the URL authenticates them, but a delivery that carries a
 * signature must carry a valid one.
 */
export const verifyWebhookSignature = (
	headers: IncomingHttpHeaders,
	raw: Buffer,
	secret: string,
): SignatureResult => {
	const gitlabToken = header(headers, "x-gitlab-token");
	if (gitlabToken !== undefined) {
		return safeEqual(gitlabToken, secret) ? "verified" : "invalid";
	}

	const giteaSignature =
		header(headers, "x-gitea-signature") ?? header(headers, "x-gogs-signature");
	if (giteaSignature !== undefined) {
		return safeEqual(giteaSignature, hmacHex(secret, raw))
			? "verified"
			: "invalid";
	}

	const sha256Signature =
		header(headers, "x-hub-signature-256") ??
		header(headers, "x-hub-signature");
	if (sha256Signature !== undefined) {
		const expected = `sha256=${hmacHex(secret, raw)}`;
		return safeEqual(sha256Signature, expected) ? "verified" : "invalid";
	}

	return "unsigned";
};
