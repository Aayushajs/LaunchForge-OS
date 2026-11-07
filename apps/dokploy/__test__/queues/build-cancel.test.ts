import { describe, expect, it } from "vitest";
import { buildCancelPattern } from "@/server/queues/build-cancel";

const matches = (pattern: string, commandLine: string) =>
	new RegExp(pattern).test(commandLine);

describe("buildCancelPattern", () => {
	const pattern = buildCancelPattern("application", "portfolio-a1b2c3");

	it("matches the build processes of the target app", () => {
		expect(
			matches(pattern, "docker build -t portfolio-a1b2c3 -f Dockerfile ."),
		).toBe(true);
		expect(
			matches(pattern, "nixpacks build /code --name portfolio-a1b2c3"),
		).toBe(true);
		expect(matches(pattern, "docker buildx build -t portfolio-a1b2c3 .")).toBe(
			true,
		);
	});

	it("does not match another workspace's build", () => {
		expect(
			matches(pattern, "docker build -t shop-x9y8z7 -f Dockerfile ."),
		).toBe(false);
	});

	it("treats dots in the app name literally", () => {
		const dotted = buildCancelPattern("application", "my.app");
		expect(matches(dotted, "docker build -t myXapp .")).toBe(false);
		expect(matches(dotted, "docker build -t my.app .")).toBe(true);
	});

	it("scopes compose cancellation to the project name", () => {
		const compose = buildCancelPattern("compose", "blog-q1w2e3");
		expect(
			matches(compose, "docker compose -p blog-q1w2e3 up -d --build"),
		).toBe(true);
		expect(matches(compose, "docker compose -p other-zzz up -d")).toBe(false);
	});
});
