import { createHmac } from "node:crypto";
import type { NextApiRequest } from "next";

interface PlainRequest {
	headers?: Record<string, string>;
	body?: unknown;
	query?: Record<string, string | string[]>;
	method?: string;
}

/**
 * Turns a plain `{ headers, body, query }` object into what a handler with
 * `bodyParser: false` receives: an async-iterable raw payload. The payload and
 * the optional GitHub signature are computed when the handler reads them, so
 * tests can still tweak `body` after building the request.
 */
export const asWebhook = (
	plain: PlainRequest,
	githubSecret?: string,
): NextApiRequest => {
	const req = {
		method: plain.method ?? "POST",
		query: plain.query ?? {},
		body: plain.body ?? {},
	} as Record<string | symbol, unknown>;
	const raw = () => Buffer.from(JSON.stringify(req.body));
	const baseHeaders: Record<string, string> = {
		"content-type": "application/json",
		...(plain.headers ?? {}),
	};
	delete baseHeaders["x-hub-signature-256"];
	Object.defineProperty(req, "headers", {
		get() {
			if (!githubSecret) return { ...baseHeaders };
			const signature = createHmac("sha256", githubSecret)
				.update(raw())
				.digest("hex");
			return { ...baseHeaders, "x-hub-signature-256": `sha256=${signature}` };
		},
	});
	req[Symbol.asyncIterator] = async function* () {
		yield raw();
	};
	return req as unknown as NextApiRequest;
};
