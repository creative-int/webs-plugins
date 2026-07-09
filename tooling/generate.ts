/**
 * Emit every Webs install adapter from the single canonical config.
 *
 *   pnpm generate          # write all generated files
 *   pnpm generate --check  # fail if generated files are stale
 *   pnpm generate --help   # print usage
 *
 * Generated files (never hand-edit): .mcp.json, .claude-plugin/*,
 * .codex-plugin/*, .cursor-plugin/*, server.json, and the README install block.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webs } from "../webs.config.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const HELP = process.argv.includes("--help") || process.argv.includes("-h");
const repoGit = `${webs.repository}.git`;
const author = { name: webs.owner.name, email: webs.owner.email };

const json = (value: unknown) => `${JSON.stringify(value, null, "\t")}\n`;

if (HELP) {
	console.log(`Usage: pnpm generate [--check]

Generate Webs plugin manifests from webs.config.ts.

Options:
  --check   fail when generated files or the README install block are stale
  --help    show this help text
`);
	process.exit(0);
}

/** Per-client install instructions; also the source for README. */
export const installClients = [
	{
		id: "mcp",
		label: "Any MCP client (.mcp.json)",
		blurb:
			"Add Webs as a Streamable HTTP MCP server. When your client prompts, complete auth; the bearer belongs in the client credential store, never in this repo.",
		steps: [
			json({
				mcpServers: {
					[webs.mcp.id]: {
						url: webs.mcp.url,
						transport: webs.mcp.transport,
					},
				},
			}).trim(),
		],
	},
	{
		id: "skills",
		label: "Any agent (npx skills)",
		blurb:
			"Installs the Webs memory skill pack for skill-aware agents. The skills teach judgment; the live MCP endpoint remains the memory surface.",
		steps: [`npx skills add ${slug()}`],
	},
	{
		id: "claude-code",
		label: "Claude Code",
		blurb:
			"Add the marketplace, install the Webs plugin, then authenticate the MCP connection before the first memory call.",
		steps: [
			`/plugin marketplace add ${slug()}`,
			`/plugin install ${webs.name}@${webs.name}`,
		],
	},
	{
		id: "codex",
		label: "Codex",
		blurb:
			"Add this repo as a Codex plugin marketplace, install from /plugins, then authenticate the MCP connection.",
		steps: [`codex plugin marketplace add ${slug()}`],
	},
	{
		id: "cursor",
		label: "Cursor",
		blurb:
			"Install Webs from the Cursor plugin marketplace, then authenticate the MCP connection.",
		steps: [`Cursor -> Settings -> Plugins -> Add marketplace -> ${slug()}`],
	},
] as const;

function slug() {
	return webs.repository.replace("https://github.com/", "");
}

function toolSummary() {
	return webs.tools.map((tool) => ({
		name: tool.name,
		scope: tool.scope,
		description: tool.description,
	}));
}

function skillSummary() {
	return webs.skills.map((skill) => ({
		name: skill.name,
		aliases: skill.aliases,
		description: skill.description,
	}));
}

function pluginMetadata() {
	return {
		repoProfile: "agent-plugin-companion",
		companionOf: "webs",
		tools: toolSummary(),
		scopes: webs.tools.map((tool) => tool.scope),
		skills: skillSummary(),
		readiness: webs.readiness.status,
		mcp: {
			id: webs.mcp.id,
			url: webs.mcp.url,
			transport: webs.mcp.transport,
		},
	};
}

const files: Record<string, string> = {
	".mcp.json": json({
		mcpServers: {
			[webs.mcp.id]: {
				url: webs.mcp.url,
				transport: webs.mcp.transport,
			},
		},
	}),

	".claude-plugin/plugin.json": json({
		name: webs.name,
		version: webs.version,
		description: webs.shortDescription,
		author,
		homepage: webs.homepage,
		repository: repoGit,
		license: webs.license,
		keywords: webs.keywords,
		displayName: webs.displayName,
		skills: "./skills",
		mcpServers: "./.mcp.json",
		metadata: pluginMetadata(),
	}),
	".claude-plugin/marketplace.json": json({
		name: webs.name,
		owner: author,
		plugins: [
			{
				name: webs.name,
				displayName: webs.displayName,
				source: "./",
				description: webs.shortDescription,
				metadata: pluginMetadata(),
			},
		],
	}),

	".codex-plugin/plugin.json": json({
		name: webs.name,
		version: webs.version,
		description: webs.shortDescription,
		author,
		homepage: webs.homepage,
		repository: repoGit,
		license: webs.license,
		keywords: webs.keywords,
		skills: "./skills",
		mcpServers: "./.mcp.json",
		interface: {
			displayName: webs.displayName,
			shortDescription: webs.shortDescription,
			longDescription: webs.longDescription,
			developerName: webs.owner.name,
			category: webs.category,
			logo: webs.logo,
			metadata: pluginMetadata(),
		},
	}),

	".cursor-plugin/plugin.json": json({
		name: webs.name,
		version: webs.version,
		description: webs.shortDescription,
		author,
		homepage: webs.homepage,
		repository: repoGit,
		license: webs.license,
		keywords: webs.keywords,
		displayName: webs.displayName,
		logo: webs.logo.replace("./", ""),
		skills: "./skills",
		mcpServers: "./.mcp.json",
		metadata: pluginMetadata(),
	}),
	".cursor-plugin/marketplace.json": json({
		name: webs.name,
		owner: author,
		metadata: {
			description: webs.shortDescription,
			...pluginMetadata(),
		},
		plugins: [
			{ name: webs.name, source: ".", description: webs.shortDescription },
		],
	}),

	"server.json": json({
		$schema:
			"https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json",
		name: webs.registryName,
		description: webs.shortDescription,
		version: webs.version,
		repository: { url: webs.repository, source: "github" },
		remotes: [{ type: webs.mcp.transport, url: webs.mcp.url }],
	}),
};

function readmeInstallBlock() {
	const lines = installClients.map((client) => {
		const body =
			client.id === "mcp"
				? ["```json", client.steps[0], "```"].join("\n")
				: ["```sh", ...client.steps, "```"].join("\n");
		return `### ${client.label}\n\n${client.blurb}\n\n${body}`;
	});
	return lines.join("\n\n");
}

const START = "<!-- AUTO-GENERATED:INSTALL START -->";
const END = "<!-- AUTO-GENERATED:INSTALL END -->";

function applyReadme(current: string): string {
	const block = `${START}\n\n${readmeInstallBlock()}\n\n${END}`;
	const re = new RegExp(`${START}[\\s\\S]*?${END}`);
	if (!re.test(current)) {
		throw new Error("README is missing the AUTO-GENERATED:INSTALL markers.");
	}
	return current.replace(re, block);
}

let stale = 0;
const report = (rel: string) => {
	console.log(`${CHECK ? "stale" : "wrote"}: ${rel}`);
	stale += 1;
};

for (const [rel, content] of Object.entries(files)) {
	const path = join(ROOT, rel);
	const existing = safeRead(path);
	if (existing === content) continue;
	if (CHECK) report(rel);
	else {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
		report(rel);
	}
}

{
	const path = join(ROOT, "README.md");
	const current = safeRead(path);
	if (current !== null) {
		const next = applyReadme(current);
		if (next !== current) {
			if (CHECK) report("README.md (install block)");
			else {
				writeFileSync(path, next);
				report("README.md (install block)");
			}
		}
	}
}

function safeRead(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

if (CHECK && stale > 0) {
	console.error(
		`\n${stale} generated file(s) are stale. Run \`pnpm generate\` and commit.`,
	);
	process.exit(1);
}

console.log(CHECK ? "generated files are up to date." : "generated all adapters.");
