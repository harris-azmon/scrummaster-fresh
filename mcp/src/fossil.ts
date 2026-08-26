// Fossil ticket / ACID client. Adapted from the acid-cli fossil backend
// (vendor/acid-cli/src/core/fossil-client.ts and fossil.ts), retargeted for
// the Scrummaster MCP server. plan.md [x] markers remain the source of truth
// for completion; the Fossil ticket table is the traceability/audit layer
// that scrummaster-review cross-checks.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

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
