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
} from "./fossil.js";
import { parseSpecAcids, scanSpecFile, storyIdFromSpecPath } from "./spec.js";

const server = new McpServer({
	name: "scrummaster-acid",
	version: "0.1.0",
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

// Parse the ACIDs defined in a scrummaster story spec.md.
server.tool(
	"acid_spec_acids",
	{
		spec_path: z.string().describe("Path to a story spec.md (e.g. scrummaster/stories/<id>/spec.md)"),
	},
	async ({ spec_path }) => {
		try {
			const acids = await scanSpecFile(spec_path);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								story_id: storyIdFromSpecPath(spec_path),
								acids,
							},
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

// Legacy runner re-export so tests can inject a mock.
export { defaultRunner };

const transport = new StdioServerTransport();
await server.connect(transport);
