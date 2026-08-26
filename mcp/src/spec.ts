// ACID scanning for scrummaster spec.md files. Adapted from the acid-cli push
// scanner (vendor/acid-cli/src/core/push.ts), which recognizes the scrummaster
// story spec format:
//   - `story.COMP.1` — a user can do X
// Trailing `[deprecated]` / `[deprecated: <reason>]` marks an ACID deprecated.
import { readTextFile } from "./fossil.js";

// story-name segment allows underscores (the story-ID convention is
// `shortname_YYYYMMDD`); component is [A-Z][A-Z0-9_-]*; the number is >=1.
const SCRUMMASTER_ACID_BULLET_PATTERN =
	/^-\s*`([A-Za-z0-9_-]+\.[A-Z][A-Z0-9_-]*\.[0-9]+(?:-[0-9]+)?)`\s*[-—]\s*(.+)$/;

const SCRUMMASTER_DEPRECATED_SUFFIX_PATTERN = /\s*\[deprecated(?::\s*(.+?))?\]\s*$/i;

export interface SpecRequirement {
	acid: string;
	requirement: string;
	deprecated: boolean;
}

// The story prefix is everything before the first '.' (e.g. `login-flow`).
export function storyIdFromSpecPath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	const match = normalized.match(/stories\/([^/]+)\/spec\.md$/);
	return match?.[1] ?? "story";
}

export function parseSpecAcids(content: string): SpecRequirement[] {
	const acids: SpecRequirement[] = [];
	for (const line of content.split("\n")) {
		const match = line.match(SCRUMMASTER_ACID_BULLET_PATTERN);
		if (!match) continue;
		let requirement = match[2]!.trim();
		let deprecated = false;
		const depMatch = requirement.match(SCRUMMASTER_DEPRECATED_SUFFIX_PATTERN);
		if (depMatch) {
			deprecated = true;
			requirement = requirement.slice(0, depMatch.index).trim();
		}
		acids.push({ acid: match[1]!, requirement, deprecated });
	}
	return acids;
}

export async function scanSpecFile(filePath: string): Promise<SpecRequirement[]> {
	const content = await readTextFile(filePath);
	return parseSpecAcids(content);
}
