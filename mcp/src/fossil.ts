// Fossil ticket / ACID client. Adapted from the acid-cli fossil backend
// (vendor/acid-cli/src/core/fossil-client.ts and fossil.ts), retargeted for
// the Scrummaster MCP server. plan.md [x] markers remain the source of truth
// for completion; the Fossil ticket table is the traceability/audit layer
// that scrummaster-review cross-checks.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export interface Runner {
	run(args: string[], cwd: string, input?: string): Promise<CommandResult>;
}

export const defaultRunner: Runner = {
	run(args, cwd, input) {
		return new Promise((resolve, reject) => {
			const child = spawn("fossil", args, {
				cwd,
				stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
			});
			if (input !== undefined) child.stdin?.end(input);
			let stdout = "";
			let stderr = "";
			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr?.on("data", (chunk) => {
				stderr += chunk;
			});
			child.once("error", reject);
			child.once("close", (code, signal) => {
				resolve({ exitCode: code ?? (signal ? 1 : 0), stdout, stderr });
			});
		});
	},
};

export interface TicketRow {
	tkt_uuid: string;
	epic_id: string | null;
	story_id: string | null;
	acid: string | null;
	component: string | null;
	status: string | null;
	acai_status: string | null;
	acai_comment: string | null;
	title: string | null;
	deprecated: number;
	last_seen_commit: string | null;
}

const TICKET_COLUMNS =
	"tkt_uuid, epic_id, story_id, acid, component, status, acai_status, acai_comment, title, deprecated, last_seen_commit";

function escapeSqlString(value: string): string {
	return value.replace(/'/g, "''");
}

export class FossilError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FossilError";
	}
}

export function storyIdFromAcid(acid: string): string {
	return acid.split(".", 1)[0] ?? acid;
}

export async function runFossil(
	runner: Runner,
	cwd: string,
	args: string[],
): Promise<string> {
	const result = await runner.run(args, cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(
			`fossil ${args[0] ?? ""} failed: ${result.stderr.trim() || "unknown error"}`,
		);
	}
	return result.stdout;
}

export async function queryTickets(
	cwd: string,
	whereClause = "1=1",
	runner: Runner = defaultRunner,
): Promise<TicketRow[]> {
	const script = [".mode json", `SELECT ${TICKET_COLUMNS} FROM ticket WHERE ${whereClause};`].join("\n");
	const result = await runner.run(["sql", "--readonly"], cwd, script);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil sql failed: ${result.stderr.trim() || "unknown error"}`);
	}
	const trimmed = result.stdout.trim();
	if (!trimmed) return [];
	try {
		return JSON.parse(trimmed) as TicketRow[];
	} catch {
		return [];
	}
}

export async function queryTicketsByStory(
	cwd: string,
	storyId: string,
	runner: Runner = defaultRunner,
): Promise<TicketRow[]> {
	return queryTickets(cwd, `story_id = '${escapeSqlString(storyId)}'`, runner);
}

export async function queryTicketsByEpic(
	cwd: string,
	epicId: string,
	runner: Runner = defaultRunner,
): Promise<TicketRow[]> {
	return queryTickets(cwd, `epic_id = '${escapeSqlString(epicId)}'`, runner);
}

// A ticket is "done" via the richer acai_status vocabulary when set, else via
// fossil's built-in Open/Closed status.
export function isRowCompleted(row: TicketRow): boolean {
	if (row.acai_status) {
		return row.acai_status === "completed" || row.acai_status === "accepted";
	}
	return row.status === "Closed";
}

export interface StoryRollup {
	storyId: string;
	total: number;
	completed: number;
	acids: string[];
}

export interface EpicRollup {
	epicId: string;
	stories: StoryRollup[];
}

export interface StatusSummary {
	epics: EpicRollup[];
	unassigned: StoryRollup[];
}

export function summarizeStatus(rows: TicketRow[]): StatusSummary {
	const byEpic = new Map<string, Map<string, TicketRow[]>>();
	const unassignedByStory = new Map<string, TicketRow[]>();

	for (const row of rows) {
		const storyId = row.story_id ?? row.acid?.split(".", 1)[0] ?? "unknown";
		if (row.epic_id) {
			const stories = byEpic.get(row.epic_id) ?? new Map<string, TicketRow[]>();
			const bucket = stories.get(storyId) ?? [];
			bucket.push(row);
			stories.set(storyId, bucket);
			byEpic.set(row.epic_id, stories);
			continue;
		}
		const bucket = unassignedByStory.get(storyId) ?? [];
		bucket.push(row);
		unassignedByStory.set(storyId, bucket);
	}

	const toStoryRollup = (storyId: string, storyRows: TicketRow[]): StoryRollup => ({
		storyId,
		total: storyRows.length,
		completed: storyRows.filter(isRowCompleted).length,
		acids: storyRows.map((row) => row.acid ?? "").filter(Boolean).sort(),
	});

	const epics: EpicRollup[] = [...byEpic.entries()]
		.map(([epicId, stories]) => ({
			epicId,
			stories: [...stories.entries()]
				.map(([storyId, storyRows]) => toStoryRollup(storyId, storyRows))
				.sort((l, r) => l.storyId.localeCompare(r.storyId)),
		}))
		.sort((l, r) => l.epicId.localeCompare(r.epicId));

	const unassigned = [...unassignedByStory.entries()]
		.map(([storyId, storyRows]) => toStoryRollup(storyId, storyRows))
		.sort((l, r) => l.storyId.localeCompare(r.storyId));

	return { epics, unassigned };
}

export interface SetStatusInput {
	storyId: string;
	states: Record<string, { status: string | null; comment?: string }>;
}

export async function setAcidStatuses(
	cwd: string,
	input: SetStatusInput,
	runner: Runner = defaultRunner,
): Promise<{ statesWritten: number; warnings: string[] }> {
	let statesWritten = 0;
	const warnings: string[] = [];
	for (const [acid, state] of Object.entries(input.states)) {
		const existing = await queryTickets(cwd, `acid = '${escapeSqlString(acid)}'`, runner);
		if (existing.length === 0) {
			warnings.push(`No ticket found for ACID '${acid}'; skipped.`);
			continue;
		}
		const args = ["ticket", "change", existing[0]!.tkt_uuid, "acai_status", state.status ?? ""];
		if (state.comment !== undefined) {
			args.push("acai_comment", state.comment);
		}
		await runFossil(runner, cwd, args);
		statesWritten += 1;
	}
	return { statesWritten, warnings };
}

// One fossil ticket per ACID, created from a spec's requirement map.
export async function pushSpecAcids(
	cwd: string,
	storyId: string,
	epicId: string | undefined,
	requirements: Record<string, { requirement: string; deprecated?: boolean }>,
	runner: Runner = defaultRunner,
): Promise<{ created: number; updated: number }> {
	let created = 0;
	let updated = 0;
	for (const [acid, req] of Object.entries(requirements)) {
		const component = acid.split(".")[1] ?? "";
		const existing = await queryTickets(cwd, `acid = '${escapeSqlString(acid)}'`, runner);
		if (existing.length === 0) {
			const args = [
				"ticket",
				"add",
				"type",
				"Story",
				"story_id",
				storyId,
				"acid",
				acid,
				"component",
				component,
				"status",
				"Open",
				"title",
				req.requirement,
				"deprecated",
				req.deprecated ? "1" : "0",
				...(epicId ? ["epic_id", epicId] : []),
			];
			await runFossil(runner, cwd, args);
			created += 1;
		} else {
			const ticket = existing[0]!;
			const args = [
				"ticket",
				"change",
				ticket.tkt_uuid,
				"title",
				req.requirement,
				"deprecated",
				req.deprecated ? "1" : "0",
				...(epicId ? ["epic_id", epicId] : []),
			];
			await runFossil(runner, cwd, args);
			updated += 1;
		}
	}
	return { created, updated };
}

export async function readTextFile(filePath: string): Promise<string> {
	return readFile(filePath, "utf8");
}

// Check whether each ACID in the provided list has accepted status.
export async function checkDependencies(
	cwd: string,
	acids: string[],
	runner: Runner = defaultRunner,
): Promise<{ accepted: string[]; notAccepted: string[] }> {
	const rows = await queryTickets(cwd);
	const acidStatusMap = new Map<string, string>();
	for (const row of rows) {
		if (row.acid) {
			acidStatusMap.set(row.acid, row.acai_status ?? row.status ?? "open");
		}
	}
	const accepted: string[] = [];
	const notAccepted: string[] = [];
	for (const acid of acids) {
		const status = acidStatusMap.get(acid) ?? "not-found";
		if (status === "accepted") {
			accepted.push(acid);
		} else {
			notAccepted.push(acid);
		}
	}
	return { accepted, notAccepted };
}

// --- Generic Fossil VCS operations (checkout/repo/commit/diff/wiki) ---
//
// Everything below was verified against a real `fossil` 2.23 binary (see the
// implementation session's scratch-checkout transcript) rather than assumed
// from documentation — several Fossil CLI details differ from what a
// Git-trained reader would guess (e.g. `diff` has no `--shortstat`/
// `--name-only`; the real flags are `--numstat`/`--brief`; `wiki create`
// fails on an existing page and `wiki commit` fails on a missing one — there
// is no single create-or-update subcommand, contrary to the docs' phrasing).

export interface FossilInfo {
	fields: Record<string, string>;
	is_open_checkout: boolean;
}

// `fossil info` prints `label:      value` lines and exits 0 whether or not
// cwd is an open checkout — presence of a `checkout` key is what
// distinguishes them. Callers must not treat "not a checkout" as an error;
// it's the normal state scrummaster-setup detects on a fresh project.
export async function getInfo(cwd: string, runner: Runner = defaultRunner): Promise<FossilInfo> {
	const result = await runner.run(["info"], cwd);
	const fields: Record<string, string> = {};
	for (const line of result.stdout.split("\n")) {
		const match = line.match(/^([A-Za-z][\w-]*):\s+(.*)$/);
		if (match) fields[match[1]!] = match[2]!.trim();
	}
	return { fields, is_open_checkout: "checkout" in fields };
}

export async function initRepo(
	cwd: string,
	repoName: string,
	runner: Runner = defaultRunner,
): Promise<{ repository_file: string; stdout: string }> {
	const repositoryFile = `${repoName}.fossil`;
	const stdout = await runFossil(runner, cwd, ["init", repositoryFile]);
	return { repository_file: repositoryFile, stdout };
}

export async function openRepo(
	cwd: string,
	repositoryFile: string,
	runner: Runner = defaultRunner,
): Promise<{ stdout: string }> {
	const stdout = await runFossil(runner, cwd, ["open", repositoryFile]);
	return { stdout };
}

export interface ChangesResult {
	added: string[];
	edited: string[];
	deleted: string[];
	missing: string[];
	renamed: string[];
	updated: string[];
	conflict: string[];
	extra: string[];
	other: string[];
}

// `fossil changes`/`fossil addremove`/`fossil update` all use the same
// change-type-code vocabulary (verified: ADDED, EDITED, DELETED, MISSING,
// RENAMED, UPDATED, CONFLICT, EXTRA — one code + whitespace + path per line).
const CHANGE_CODE_BUCKETS: Record<string, keyof Omit<ChangesResult, "other">> = {
	ADDED: "added",
	EDITED: "edited",
	DELETED: "deleted",
	MISSING: "missing",
	RENAMED: "renamed",
	UPDATED: "updated",
	CONFLICT: "conflict",
	EXTRA: "extra",
};

function parseChangeLines(stdout: string): ChangesResult {
	const out: ChangesResult = {
		added: [],
		edited: [],
		deleted: [],
		missing: [],
		renamed: [],
		updated: [],
		conflict: [],
		extra: [],
		other: [],
	};
	for (const rawLine of stdout.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		const match = line.match(/^(\S+)\s+(.+)$/);
		if (!match) continue;
		const bucket = CHANGE_CODE_BUCKETS[match[1]!];
		if (bucket) out[bucket].push(match[2]!.trim());
		else out.other.push(line);
	}
	return out;
}

export async function getChanges(
	cwd: string,
	options: { differ?: boolean } = {},
	runner: Runner = defaultRunner,
): Promise<ChangesResult> {
	const args = ["changes"];
	if (options.differ) args.push("--differ");
	const result = await runner.run(args, cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil changes failed: ${result.stderr.trim() || "unknown error"}`);
	}
	return parseChangeLines(result.stdout);
}

export interface DiffNumstat {
	per_file: Array<{ path: string; added: number; removed: number }>;
	total_added: number;
	total_removed: number;
	files_changed: number;
}

export async function getDiff(
	cwd: string,
	options: {
		brief?: boolean;
		numstat?: boolean;
		fromCheckin?: string;
		toCheckin?: string;
		paths?: string[];
	} = {},
	runner: Runner = defaultRunner,
): Promise<{ diff?: string; files?: string[]; numstat?: DiffNumstat }> {
	const args = ["diff"];
	if (options.brief) args.push("--brief");
	if (options.numstat) args.push("--numstat");
	if (options.fromCheckin) args.push("--from", options.fromCheckin);
	if (options.toCheckin) args.push("--to", options.toCheckin);
	if (options.paths) args.push(...options.paths);
	const result = await runner.run(args, cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil diff failed: ${result.stderr.trim() || "unknown error"}`);
	}
	if (options.brief) {
		// `--brief` still prefixes each line with a change-type code (verified:
		// "ADDED path" / "CHANGED path", not a bare filename list) — strip it.
		const files = result.stdout
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => l.match(/^\S+\s+(.+)$/)?.[1]?.trim() ?? l);
		return { files };
	}
	if (options.numstat) {
		const perFile: DiffNumstat["per_file"] = [];
		let totalAdded = 0;
		let totalRemoved = 0;
		let filesChanged = 0;
		for (const rawLine of result.stdout.split("\n")) {
			const line = rawLine.trim();
			if (!line) continue;
			const totalMatch = line.match(/^(\d+)\s+(\d+)\s+TOTAL over (\d+) changed files?$/);
			if (totalMatch) {
				totalAdded = Number(totalMatch[1]);
				totalRemoved = Number(totalMatch[2]);
				filesChanged = Number(totalMatch[3]);
				continue;
			}
			const fileMatch = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
			if (fileMatch) {
				perFile.push({ added: Number(fileMatch[1]), removed: Number(fileMatch[2]), path: fileMatch[3]!.trim() });
			}
		}
		return { numstat: { per_file: perFile, total_added: totalAdded, total_removed: totalRemoved, files_changed: filesChanged } };
	}
	return { diff: result.stdout };
}

export async function listFiles(cwd: string, runner: Runner = defaultRunner): Promise<{ files: string[] }> {
	const result = await runner.run(["ls"], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil ls failed: ${result.stderr.trim() || "unknown error"}`);
	}
	return { files: result.stdout.split("\n").map((l) => l.trim()).filter(Boolean) };
}

export async function addPaths(
	cwd: string,
	paths: string[] = ["."],
	runner: Runner = defaultRunner,
): Promise<ChangesResult> {
	const result = await runner.run(["add", ...paths], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil add failed: ${result.stderr.trim() || "unknown error"}`);
	}
	return parseChangeLines(result.stdout);
}

export async function addRemove(cwd: string, runner: Runner = defaultRunner): Promise<ChangesResult> {
	const result = await runner.run(["addremove"], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil addremove failed: ${result.stderr.trim() || "unknown error"}`);
	}
	return parseChangeLines(result.stdout);
}

export interface CommitResult {
	committed: boolean;
	hash?: string;
	hash_short?: string;
	reason?: string;
	stdout: string;
}

// Wraps `fossil commit`. Never throws for "nothing has changed" (verified
// exact stderr text) — several skill steps branch on that as a normal,
// expected outcome rather than a failure.
export async function commit(
	cwd: string,
	options: { message: string; paths?: string[] },
	runner: Runner = defaultRunner,
): Promise<CommitResult> {
	const args = ["commit", "-m", options.message, "--no-warnings"];
	if (options.paths) args.push(...options.paths);
	const result = await runner.run(args, cwd);
	if (result.exitCode !== 0) {
		const combined = `${result.stdout}\n${result.stderr}`;
		if (/nothing has changed/i.test(combined)) {
			return { committed: false, reason: combined.trim(), stdout: result.stdout };
		}
		throw new FossilError(`fossil commit failed: ${result.stderr.trim() || "unknown error"}`);
	}
	const hashMatch = result.stdout.match(/^New_Version:\s*(\S+)/m);
	const hash = hashMatch?.[1];
	return {
		committed: true,
		hash,
		hash_short: hash?.slice(0, 7),
		stdout: result.stdout,
	};
}

export async function revertPaths(
	cwd: string,
	paths: string[],
	runner: Runner = defaultRunner,
): Promise<{ reverted: string[]; stdout: string }> {
	const result = await runner.run(["revert", ...paths], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil revert failed: ${result.stderr.trim() || "unknown error"}`);
	}
	const reverted = result.stdout
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("REVERT"))
		.map((l) => l.match(/^REVERT\s+(.+)$/)?.[1]?.trim() ?? l);
	return { reverted, stdout: result.stdout };
}

export async function updateCheckin(
	cwd: string,
	target: string,
	runner: Runner = defaultRunner,
): Promise<{ conflicts: string[]; stdout: string }> {
	const result = await runner.run(["update", target], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil update failed: ${result.stderr.trim() || "unknown error"}`);
	}
	const parsed = parseChangeLines(result.stdout);
	return { conflicts: parsed.conflict, stdout: result.stdout };
}

export async function getTimeline(
	cwd: string,
	limit = 10,
	runner: Runner = defaultRunner,
): Promise<{ stdout: string }> {
	const result = await runner.run(["timeline", "-n", String(limit), "-t", "ci"], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil timeline failed: ${result.stderr.trim() || "unknown error"}`);
	}
	// Timeline's block format (date headers, indented entries with inline
	// tags) isn't worth a bespoke parser for the one general-purpose
	// debugging/audit tool this is — return the text as-is.
	return { stdout: result.stdout };
}

export async function listBranches(
	cwd: string,
	runner: Runner = defaultRunner,
): Promise<{ branches: string[]; current?: string }> {
	const result = await runner.run(["branch", "list"], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil branch list failed: ${result.stderr.trim() || "unknown error"}`);
	}
	const branches: string[] = [];
	let current: string | undefined;
	for (const rawLine of result.stdout.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		const match = line.match(/^(\*)?\s*(.+)$/);
		if (!match) continue;
		const name = match[2]!.trim();
		branches.push(name);
		if (match[1]) current = name;
	}
	return { branches, current };
}

export async function setSetting(
	cwd: string,
	name: string,
	value: string,
	runner: Runner = defaultRunner,
): Promise<{ stdout: string }> {
	const stdout = await runFossil(runner, cwd, ["settings", name, value]);
	return { stdout };
}

// Resolves the packaged ticket_schema.sql relative to this compiled module
// (mcp/dist/fossil.js -> up to the repo root -> skills/scrummaster-setup/assets/).
function defaultTicketSchemaPath(): string {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	return join(moduleDir, "..", "..", "skills", "scrummaster-setup", "assets", "ticket_schema.sql");
}

export async function applyTicketSchema(
	cwd: string,
	schemaSql?: string,
	runner: Runner = defaultRunner,
): Promise<{ applied: boolean; columns: string[]; has_acid_column: boolean }> {
	const sql = schemaSql ?? (await readTextFile(defaultTicketSchemaPath()));
	const applyResult = await runner.run(["sql"], cwd, sql);
	if (applyResult.exitCode !== 0) {
		throw new FossilError(`fossil sql (apply ticket schema) failed: ${applyResult.stderr.trim() || "unknown error"}`);
	}
	const verifyScript = [".mode json", "SELECT name FROM pragma_table_info('ticket');"].join("\n");
	const verifyResult = await runner.run(["sql", "--readonly"], cwd, verifyScript);
	if (verifyResult.exitCode !== 0) {
		throw new FossilError(`fossil sql (verify ticket schema) failed: ${verifyResult.stderr.trim() || "unknown error"}`);
	}
	let columns: string[] = [];
	try {
		const rows = JSON.parse(verifyResult.stdout.trim() || "[]") as Array<{ name: string }>;
		columns = rows.map((r) => r.name);
	} catch {
		columns = [];
	}
	return { applied: true, columns, has_acid_column: columns.includes("acid") };
}

// --- Fossil wiki ---
//
// Verified: `wiki create <page>` fails ("already exists") if the page
// exists; `wiki commit <page>` fails ("no such wiki page") if it doesn't.
// There is no single create-or-update subcommand despite how the CLI docs
// read — writeWikiPage tries `create` first and falls back to `commit` on
// the "already exists" error, so callers get create-or-update semantics
// without needing to check existence themselves first.
const WIKI_ALREADY_EXISTS = /already exists/i;
const WIKI_NOT_FOUND = /wiki page \[.*\] not found|no such wiki page/i;

export async function writeWikiPage(
	cwd: string,
	page: string,
	content: string,
	mimetype: "markdown" | "plain" = "markdown",
	runner: Runner = defaultRunner,
): Promise<{ page: string; mimetype: string }> {
	const create = await runner.run(["wiki", "create", page, "-M", mimetype], cwd, content);
	if (create.exitCode === 0) return { page, mimetype };
	if (WIKI_ALREADY_EXISTS.test(`${create.stdout}\n${create.stderr}`)) {
		const update = await runner.run(["wiki", "commit", page, "-M", mimetype], cwd, content);
		if (update.exitCode !== 0) {
			throw new FossilError(`fossil wiki commit failed: ${update.stderr.trim() || "unknown error"}`);
		}
		return { page, mimetype };
	}
	throw new FossilError(`fossil wiki create failed: ${create.stderr.trim() || "unknown error"}`);
}

export async function readWikiPage(
	cwd: string,
	page: string,
	runner: Runner = defaultRunner,
): Promise<{ page: string; exists: boolean; content?: string }> {
	const result = await runner.run(["wiki", "export", page, "-"], cwd);
	if (result.exitCode === 0) return { page, exists: true, content: result.stdout };
	if (WIKI_NOT_FOUND.test(`${result.stdout}\n${result.stderr}`)) {
		return { page, exists: false };
	}
	throw new FossilError(`fossil wiki export failed: ${result.stderr.trim() || "unknown error"}`);
}

export async function readWikiPagesBatch(
	cwd: string,
	pages: string[],
	runner: Runner = defaultRunner,
): Promise<Record<string, { exists: boolean; content?: string }>> {
	const out: Record<string, { exists: boolean; content?: string }> = {};
	for (const page of pages) {
		const { exists, content } = await readWikiPage(cwd, page, runner);
		out[page] = { exists, ...(content !== undefined ? { content } : {}) };
	}
	return out;
}

export async function listWikiPages(cwd: string, runner: Runner = defaultRunner): Promise<{ pages: string[] }> {
	const result = await runner.run(["wiki", "list"], cwd);
	if (result.exitCode !== 0) {
		throw new FossilError(`fossil wiki list failed: ${result.stderr.trim() || "unknown error"}`);
	}
	return { pages: result.stdout.split("\n").map((l) => l.trim()).filter(Boolean) };
}
