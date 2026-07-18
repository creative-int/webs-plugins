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
		label: "Any MCP client (generic .mcp.json)",
		blurb:
			"Add Webs as a remote Streamable HTTP server, then invoke `readiness` to begin client-owned OAuth. Never paste a bearer into this repository.",
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
			"Install the four Webs judgment skills. This does not connect MCP by itself; also use the generic MCP configuration above unless your agent already has the Webs plugin.",
		steps: [`npx skills add ${slug()}`],
	},
	{
		id: "pi",
		label: "Pi",
		blurb:
			"Install the native seven-tool extension and the four Webs judgment skills. Authenticate with the Webs CLI, then ask Pi to invoke `readiness`; the extension reuses the selected CLI profile without printing its token.",
		steps: [
			`pi install git:github.com/${slug()}`,
			"webs login --profile prod",
		],
	},
	{
		id: "claude-code",
		label: "Claude Code",
		blurb:
			"Add the marketplace and install the Webs plugin. Invoke `readiness` and complete the Webs-owned OAuth flow when Claude prompts.",
		steps: [
			`/plugin marketplace add ${slug()}`,
			`/plugin install ${webs.name}@${webs.name}`,
		],
	},
	{
		id: "codex",
		label: "Codex",
		blurb:
			"Add this repository as a Codex plugin marketplace, install Webs from `/plugins`, then invoke `readiness` and complete OAuth.",
		steps: [`codex plugin marketplace add ${slug()}`],
	},
	{
		id: "cursor",
		label: "Cursor",
		blurb:
			"Install Webs from the Cursor plugin marketplace, then invoke `readiness` and complete OAuth when Cursor prompts.",
		steps: [`Cursor → Settings → Plugins → Add marketplace → ${slug()}`],
	},
] as const;

function slug() {
	return webs.repository.replace("https://github.com/", "");
}

function toolSummary() {
	return webs.tools.map((tool) => ({
		name: tool.name,
		protectedBy: tool.protectedBy,
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
		oauthScopes: webs.oauthScopes,
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
			capabilities: ["Remote MCP", "Memory", "Research"],
			websiteURL: webs.homepage,
			defaultPrompt: [
				"Check whether my Webs memory connection is ready.",
				"Recall what we have saved about this task.",
				"Ask Webs memory a cited question.",
			],
			logo: webs.logo,
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
	lines.push(`### Quickstart: authenticate and verify

Every install path converges on the same remote MCP server and Webs-owned OAuth flow:

1. If you installed only with \`npx skills\`, also add the generic MCP configuration above. Skills teach judgment; MCP or the native Pi extension provides the seven live tools.
2. Pi reads the selected Webs CLI profile from \`~/.config/webs/config.json\` (or \`WEBS_CONFIG\`). Run \`webs login --profile <name>\`, select it with \`WEBS_PROFILE\` when needed, and never paste or print its bearer token. Environment-only setups may use \`WEBS_MCP_TOKEN\` and \`WEBS_MCP_URL\`.
3. Invoke \`readiness\`. For generic MCP clients, complete OAuth in the client-owned browser or credential flow when prompted. The intended connection requests \`${webs.oauthScopes.join(" ")}\`.
4. Invoke \`readiness\` again after authentication. Treat the connection as ready only when Webs confirms auth, entitlement, granted scopes, and tool availability.
5. Exercise memory deliberately: call \`context\` with \`{"task":"...","why":"..."}\` only when prior memory may help; call \`recall\` with \`{"query":"..."}\`; then save a real source URL with \`{"urls":["https://example.com"],"task":"...","why":"..."}\`.

Use \`ask\` when you need a cited answer rather than retrieval results. Replace the example URL before saving.`);
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
