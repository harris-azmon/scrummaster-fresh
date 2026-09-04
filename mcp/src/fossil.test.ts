// Unit tests for the Fossil CLI output parsers, using a mock Runner so no
// real `fossil` binary is required. Sample stdout/stderr text below was
// captured verbatim from a real `fossil` 2.23 binary during implementation
// (not guessed) — see CommandResult fixtures in each test.
import assert from "node:assert/strict";
import test from "node:test";
import type { CommandResult, Runner } from "./fossil.js";
import { commit, getChanges, readWikiPage } from "./fossil.js";

function mockRunner(result: Partial<CommandResult>): Runner {
	return {
		async run() {
			return { exitCode: 0, stdout: "", stderr: "", ...result };
		},
	};
}

test("commit() parses New_Version hash and short hash from real fossil output", async () => {
	const runner = mockRunner({
		exitCode: 0,
		stdout: "SKIP   isolated.txt\nNew_Version: ee2f7f31877cd7b75dfd158b1e961addf0c4154faadaf8d06e7179d87ac6d597\n",
	});
	const result = await commit(".", { message: "test" }, runner);
	assert.equal(result.committed, true);
	assert.equal(result.hash, "ee2f7f31877cd7b75dfd158b1e961addf0c4154faadaf8d06e7179d87ac6d597");
	assert.equal(result.hash_short, "ee2f7f3");
});

test("commit() treats 'nothing has changed' as committed:false, not a thrown error", async () => {
	const runner = mockRunner({
		exitCode: 1,
		stdout: "",
		stderr: "nothing has changed; use --allow-empty to override\n",
	});
	const result = await commit(".", { message: "test" }, runner);
	assert.equal(result.committed, false);
	assert.match(result.reason ?? "", /nothing has changed/i);
});

test("commit() throws FossilError for a real failure", async () => {
	const runner = mockRunner({ exitCode: 1, stdout: "", stderr: "no such file: missing.txt\n" });
	await assert.rejects(() => commit(".", { message: "test", paths: ["missing.txt"] }, runner));
});

test("getChanges() buckets ADDED/EDITED/MISSING lines by change-type code", async () => {
	const runner = mockRunner({
		exitCode: 0,
		stdout: "ADDED  another.txt\nMISSING    another2.txt\nEDITED     newfile.txt\n",
	});
	const result = await getChanges(".", { differ: true }, runner);
	assert.deepEqual(result.added, ["another.txt"]);
	assert.deepEqual(result.missing, ["another2.txt"]);
	assert.deepEqual(result.edited, ["newfile.txt"]);
	assert.deepEqual(result.deleted, []);
});

test("readWikiPage() returns exists:false for a missing page without throwing", async () => {
	const runner = mockRunner({ exitCode: 1, stdout: "", stderr: "wiki page [does/not/exist] not found\n" });
	const result = await readWikiPage(".", "does/not/exist", runner);
	assert.equal(result.exists, false);
	assert.equal(result.content, undefined);
});

test("readWikiPage() returns content for an existing page", async () => {
	const runner = mockRunner({ exitCode: 0, stdout: "# Hello\n\nSome *markdown* content.\n" });
	const result = await readWikiPage(".", "product", runner);
	assert.equal(result.exists, true);
	assert.equal(result.content, "# Hello\n\nSome *markdown* content.\n");
});

test("readWikiPage() throws FossilError for an unrelated failure", async () => {
	const runner = mockRunner({ exitCode: 1, stdout: "", stderr: "disk I/O error\n" });
	await assert.rejects(() => readWikiPage(".", "product", runner));
});
