// ACID scanning for scrummaster spec content (fetched from the `stories/<id>/spec`
// wiki page, or passed raw while a story is still being drafted). Adapted from
// the acid-cli push scanner (vendor/acid-cli/src/core/push.ts), which
// recognizes the scrummaster story spec format:
//   - `story.COMP.1` — a user can do X
// Trailing `[deprecated]` / `[deprecated: <reason>]` marks an ACID deprecated.

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
