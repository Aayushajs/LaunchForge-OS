import { describe, expect, it } from "vitest";
import { isPublicHost } from "@/utils/public-host";

describe("isPublicHost", () => {
	it.each([
		"localhost",
		"app.localhost",
		"nas.local",
		"127.0.0.1",
		"10.0.0.5",
		"172.20.1.1",
		"192.168.1.20",
		"100.64.0.1",
		"[::1]",
		"fd12::1",
	])("treats %s as private", (host) => {
		expect(isPublicHost(host)).toBe(false);
	});

	it.each([
		"deploy.example.com",
		"203.0.113.10",
		"172.32.0.1",
		"fcbarcelona.com",
		"fd.example.org",
		"portfolio.127.0.0.1.sslip.io",
	])("treats %s as public", (host) => {
		expect(isPublicHost(host)).toBe(true);
	});
});
