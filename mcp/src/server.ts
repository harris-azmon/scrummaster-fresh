import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	defaultRunner,
	queryTickets,
	queryTicketsByStory,
	queryTicketsByEpic,
	summarizeStatus,
	setAcidStatuses,
	pushSpecAcids,
	getInfo,
	initRepo,
	openRepo,
	getChanges,
	getDiff,
	listFiles,
	addPaths,
	addRemove,
	commit,
	revertPaths,
	updateCheckin,
	getTimeline,
	listBranches,
	applyTicketSchema,
	setSetting,
	writeWikiPage,
	readWikiPage,
	readWikiPagesBatch,
	listWikiPages,
} from "./fossil.js";
import { parseSpecAcids } from "./spec.js";

const server = new McpServer({
	name: "scrummaster-fossil",
	version: "0.2.0",
});

// The cwd the tools operate in. MCP stdio servers run in the project cwd by
// default; allow override via the FOSSIL_CWD env var (matches the old
// ACID_FOSSIL_CWD knob).
const cwd = process.env.FOSSIL_CWD ?? process.cwd();

// Raw ticket rows for a story or all tickets.
server.tool(
	"acid_tickets",
	{
		story_id: z.string().optional().describe("Filter tickets to one story_id"),
		epic_id: z.string().optional().describe("Filter tickets to one epic_id"),
	},
	async ({ story_id, epic_id }) => {
		try {
			let rows;
			if (story_id) rows = await queryTicketsByStory(cwd, story_id);
			else if (epic_id) rows = await queryTicketsByEpic(cwd, epic_id);
			else rows = await queryTickets(cwd);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							rows.map((r) => ({
								tkt_uuid: r.tkt_uuid,
								epic_id: r.epic_id,
								story_id: r.story_id,
								acid: r.acid,
								status: r.status,
								acai_status: r.acai_status,
								title: r.title,
								deprecated: r.deprecated,
							})),
							null,
							2,
						),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Epic/story/ACID completion rollup from the fossil ticket table.
server.tool(
	"acid_ticket_rollup",
	{
		epic_id: z.string().optional().describe("Scope the rollup to one epic"),
	},
	async ({ epic_id }) => {
		try {
			const rows = epic_id
				? await queryTicketsByEpic(cwd, epic_id)
				: await queryTickets(cwd);
			return {
				content: [{ type: "text", text: JSON.stringify(summarizeStatus(rows), null, 2) }],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Parse the ACIDs defined in a story's `stories/<story_id>/spec` wiki page.
server.tool(
	"acid_wiki_spec_acids",
	{
		story_id: z.string().describe("The story_id whose spec page to read (stories/<story_id>/spec)"),
	},
	async ({ story_id }) => {
		try {
			const { exists, content } = await readWikiPage(cwd, `stories/${story_id}/spec`);
			if (!exists) {
				return {
					content: [{ type: "text", text: `Error: wiki page stories/${story_id}/spec not found` }],
					isError: true,
				};
			}
			const acids = parseSpecAcids(content ?? "");
			return {
				content: [{ type: "text", text: JSON.stringify({ story_id, acids }, null, 2) }],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Create/update one fossil ticket per ACID from a spec's requirement map.
server.tool(
	"acid_push",
	{
		story_id: z.string().describe("The story_id (ACID prefix) for the tickets"),
		epic_id: z.string().optional().describe("Optional epic_id to tag tickets with"),
		requirements: z
			.record(
				z.object({
					requirement: z.string(),
					deprecated: z.boolean().optional(),
				}),
			)
			.describe("Map of ACID -> { requirement, deprecated? }"),
	},
	async ({ story_id, epic_id, requirements }) => {
		try {
			const result = await pushSpecAcids(cwd, story_id, epic_id, requirements);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ ...result, story_id }, null, 2),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Update ACID ticket statuses/comment (used by scrummaster-review). The fossil
// ticket is the audit layer; plan.md [x] markers remain the completion source.
server.tool(
	"acid_set_status",
	{
		story_id: z.string().describe("Story the ACIDs belong to"),
		states: z
			.record(
				z.object({
					status: z
						.enum(["assigned", "blocked", "incomplete", "completed", "rejected", "accepted"])
						.nullable(),
					comment: z.string().optional(),
				}),
			)
			.describe("Map of ACID -> { status, comment? }"),
	},
	async ({ story_id, states }) => {
		try {
			const result = await setAcidStatuses(cwd, { storyId: story_id, states });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Check whether each ACID in the provided list has accepted status.
server.tool(
	"acid_check_dependencies",
	{
		acids: z.array(z.string()).describe("List of ACIDs to check acceptance for"),
	},
	async ({ acids }) => {
		try {
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
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ accepted, notAccepted }, null, 2),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
);

// Raw ACID text from a spec path, for convenience/verification.
server.tool(
	"acid_parse_spec_text",
	{
		spec_text: z.string().describe("Raw spec.md content to parse ACIDs from"),
	},
	async ({ spec_text }) => {
		const acids = parseSpecAcids(spec_text);
		return {
			content: [{ type: "text", text: JSON.stringify(acids, null, 2) }],
		};
	},
);

// --- Generic Fossil VCS tools ---

server.tool("fossil_info", {}, async () => {
	try {
		const info = await getInfo(cwd);
		return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

server.tool(
	"fossil_init",
	{ repo_name: z.string().describe("Repository filename stem (e.g. 'myproject' -> myproject.fossil)") },
	async ({ repo_name }) => {
		try {
			const result = await initRepo(cwd, repo_name);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_open",
	{ repository_file: z.string().describe("Path to the .fossil repository file to open a checkout of") },
	async ({ repository_file }) => {
		try {
			const result = await openRepo(cwd, repository_file);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_changes",
	{ differ: z.boolean().optional().describe("Pass --differ (show diffs of uncommitted changes)") },
	async ({ differ }) => {
		try {
			const result = await getChanges(cwd, { differ });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_diff",
	{
		brief: z.boolean().optional().describe("Show only changed filenames (fossil --brief)"),
		numstat: z.boolean().optional().describe("Show only per-file/total added+removed line counts (fossil --numstat)"),
		from_checkin: z.string().optional().describe("Source check-in (fossil --from)"),
		to_checkin: z.string().optional().describe("Target check-in, e.g. 'current' (fossil --to)"),
		paths: z.array(z.string()).optional().describe("Limit the diff to these paths"),
	},
	async ({ brief, numstat, from_checkin, to_checkin, paths }) => {
		try {
			const result = await getDiff(cwd, {
				brief,
				numstat,
				fromCheckin: from_checkin,
				toCheckin: to_checkin,
				paths,
			});
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool("fossil_ls", {}, async () => {
	try {
		const result = await listFiles(cwd);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

server.tool(
	"fossil_add",
	{ paths: z.array(z.string()).optional().describe("Paths to add (default ['.'])") },
	async ({ paths }) => {
		try {
			const result = await addPaths(cwd, paths);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool("fossil_addremove", {}, async () => {
	try {
		const result = await addRemove(cwd);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

server.tool(
	"fossil_commit",
	{
		message: z.string().describe("Commit message"),
		paths: z.array(z.string()).optional().describe("Limit the commit to these paths (default: all changes)"),
	},
	async ({ message, paths }) => {
		try {
			const result = await commit(cwd, { message, paths });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_revert",
	{ paths: z.array(z.string()).describe("Paths to revert to their last committed state") },
	async ({ paths }) => {
		try {
			const result = await revertPaths(cwd, paths);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_update",
	{ target: z.string().describe("Check-in hash, tag, branch name, 'current', or 'latest'") },
	async ({ target }) => {
		try {
			const result = await updateCheckin(cwd, target);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_timeline",
	{ limit: z.number().optional().describe("Number of check-ins to show (default 10)") },
	async ({ limit }) => {
		try {
			const result = await getTimeline(cwd, limit);
			return { content: [{ type: "text", text: result.stdout }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool("fossil_branch_list", {}, async () => {
	try {
		const result = await listBranches(cwd);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

server.tool(
	"fossil_apply_ticket_schema",
	{ schema_sql: z.string().optional().describe("Override SQL to apply (default: the packaged ticket_schema.sql)") },
	async ({ schema_sql }) => {
		try {
			const result = await applyTicketSchema(cwd, schema_sql);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool(
	"fossil_set_setting",
	{ name: z.string().describe("Setting name, e.g. 'autosync'"), value: z.string().describe("Setting value, e.g. 'off'") },
	async ({ name, value }) => {
		try {
			const result = await setSetting(cwd, name, value);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

// --- Fossil wiki tools (the primary store for all scrummaster docs/registries/metadata) ---

server.tool(
	"wiki_write",
	{
		page: z.string().describe("Wiki page name, e.g. 'stories/<id>/spec'"),
		content: z.string().describe("Full page content (this replaces the page's content entirely)"),
		mimetype: z.enum(["markdown", "plain"]).optional().describe("Defaults to 'markdown'"),
	},
	async ({ page, content, mimetype }) => {
		try {
			const result = await writeWikiPage(cwd, page, content, mimetype ?? "markdown");
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool("wiki_read", { page: z.string().describe("Wiki page name to read") }, async ({ page }) => {
	try {
		const result = await readWikiPage(cwd, page);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

server.tool(
	"wiki_read_batch",
	{ pages: z.array(z.string()).describe("Wiki page names to read in one round trip") },
	async ({ pages }) => {
		try {
			const result = await readWikiPagesBatch(cwd, pages);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (error: any) {
			return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
		}
	},
);

server.tool("wiki_list", {}, async () => {
	try {
		const result = await listWikiPages(cwd);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error: any) {
		return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
	}
});

// Legacy runner re-export so tests can inject a mock.
export { defaultRunner };

const transport = new StdioServerTransport();
await server.connect(transport);
