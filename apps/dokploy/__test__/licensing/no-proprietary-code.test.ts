import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// LaunchForge ships only Apache-2.0 code. Dokploy's source-available
// `/proprietary` modules must never come back through a merge or copy-paste.
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SCANNED_ROOTS = ["apps", "packages"];
const SKIPPED_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const walk = (
	dir: string,
	onFile: (file: string) => void,
	onDir: (d: string) => void,
) => {
	for (const entry of readdirSync(dir)) {
		if (SKIPPED_DIRS.has(entry)) continue;
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) {
			onDir(full);
			walk(full, onFile, onDir);
		} else if (SOURCE_FILE.test(entry)) {
			onFile(full);
		}
	}
};

const collect = () => {
	const proprietaryDirs: string[] = [];
	const importingFiles: string[] = [];
	const thisFile = path.resolve(__filename);
	for (const root of SCANNED_ROOTS) {
		walk(
			path.join(REPO_ROOT, root),
			(file) => {
				if (path.resolve(file) === thisFile) return;
				if (/["'][^"']*\/proprietary\//.test(readFileSync(file, "utf8"))) {
					importingFiles.push(path.relative(REPO_ROOT, file));
				}
			},
			(dir) => {
				if (path.basename(dir) === "proprietary") {
					proprietaryDirs.push(path.relative(REPO_ROOT, dir));
				}
			},
		);
	}
	return { proprietaryDirs, importingFiles };
};

describe("licensing guard", () => {
	const { proprietaryDirs, importingFiles } = collect();

	it("has no proprietary directories", () => {
		expect(proprietaryDirs).toEqual([]);
	});

	it("has no imports from proprietary paths", () => {
		expect(importingFiles).toEqual([]);
	});
});
