/**
 * Deterministic smoke for the Webs plugin companion repo.
 *
 * Validates generated manifests, MCP metadata shape, and skill frontmatter.
 * It deliberately does not require a bearer token.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import createWebsPiExtension, {
	websToolContracts,
	type WebsTransport,
} from "../extensions/webs.ts";
import { webs } from "../webs.config.ts";

const HELP = process.argv.includes("--help") || process.argv.includes("-h");

if (HELP) {
	console.log(`Usage: pnpm smoke

Validates generated Webs plugin manifests and skill frontmatter.
No bearer token is required.
`);
	process.exit(0);
}

const ROOT = join(import.meta.dirname, "..");
const expectedSkillNames = webs.skills.map((skill) => skill.name).sort();
const expectedToolNames = webs.tools.map((tool) => tool.name).sort();
const expectedToolMetadata = webs.tools.map((tool) => ({
	name: tool.name,
	protectedBy: tool.protectedBy,
	description: tool.description,
}));
const expectedOAuthScopes = [...webs.oauthScopes];

try {
	checkGeneratedManifestShape();
	checkClientCoverage();
	checkSkillFrontmatter();
	checkPiContract();
	checkPublicContractCopy();
	console.log(
		`Webs plugin smoke OK: ${expectedToolNames.length} tools, ${expectedOAuthScopes.length} OAuth scopes, ${expectedSkillNames.length} skills.`,
	);
} catch (error) {
	console.error(`Webs plugin smoke failed: ${(error as Error).message}`);
	process.exit(1);
}

function checkClientCoverage() {
	const expectedIds = [
		"codex",
		"claude",
		"cursor",
		"windsurf",
		"vscode",
		"generic",
	];
	assert(
		JSON.stringify(webs.connectClients.map((client) => client.id)) ===
			JSON.stringify(expectedIds),
		"generated client snapshot must contain the canonical six clients",
	);
	for (const client of webs.connectClients) {
		const filenames = {
			codex: "config.toml",
			claude: "add.sh",
			cursor: "mcp.json",
			windsurf: "mcp_config.json",
			vscode: "mcp.json",
			generic: "initialize.sh",
		} as const;
		const relative = `clients/${client.id}/${filenames[client.id]}`;
		assert(existsSync(join(ROOT, relative)), `${relative} is missing`);
		assert(
			readFileSync(join(ROOT, relative), "utf8").trim() === client.value.trim(),
			`${relative} drifted from the Webs connect snapshot`,
		);
	}
}

function checkPiContract() {
	const packageJson = readJson<{
		files?: string[];
		pi?: { extensions?: string[]; skills?: string[] };
	}>("package.json");
	assert(
		JSON.stringify(packageJson.pi?.extensions) ===
			JSON.stringify(webs.pi.extensions),
		"package.json Pi extension path mismatch",
	);
	assert(
		JSON.stringify(packageJson.pi?.skills) === JSON.stringify(webs.pi.skills),
		"package.json Pi skills path mismatch",
	);
	assert(
		packageJson.files?.includes("extensions"),
		"package.json does not publish extensions",
	);

	const registered: Array<{
		description?: string;
		name?: string;
		parameters?: Record<string, unknown>;
	}> = [];
	let hooks = 0;
	const transport: WebsTransport = {
		async callTool() {
			return {};
		},
	};
	createWebsPiExtension(transport)({
		on() {
			hooks += 1;
		},
		registerTool(tool: unknown) {
			registered.push(tool as (typeof registered)[number]);
		},
	} as unknown as ExtensionAPI);

	const registeredNames = registered.map((tool) => tool.name).sort();
	assert(
		JSON.stringify(registeredNames) === JSON.stringify(expectedToolNames),
		"Pi registered tool list mismatch",
	);
	assert(registered.length === 7, "Pi must register exactly seven tools");
	assert(hooks === 0, "Pi companion must not register lifecycle hooks");
	assert(
		JSON.stringify(websToolContracts.map((tool) => tool.name).sort()) ===
			JSON.stringify(expectedToolNames),
		"Pi schema contract drifted from webs.config.ts",
	);
	const run = registered.find((tool) => tool.name === "run")?.parameters as
		| { anyOf?: unknown; additionalProperties?: unknown }
		| undefined;
	assert(Array.isArray(run?.anyOf), "Pi run schema is missing poll/new-run anyOf");
	assert(
		run?.additionalProperties === false,
		"Pi run schema must reject additional properties",
	);
}

function checkGeneratedManifestShape() {
	const mcp = readJson<{
		mcpServers?: Record<
			string,
			{ type?: string; url?: string; transport?: string }
		>;
	}>(".mcp.json");
	const mcpServer = mcp.mcpServers?.[webs.mcp.id];
	assert(
		mcpServer?.type === "http",
		'.mcp.json must declare type "http" for Claude Code',
	);
	assert(mcpServer?.url === webs.mcp.url, ".mcp.json uses the wrong MCP URL");
	assert(
		mcpServer.transport === webs.mcp.transport,
		".mcp.json uses the wrong transport",
	);

	const server = readJson<{
		name?: string;
		remotes?: Array<{ type?: string; url?: string }>;
	}>("server.json");
	assert(server.name === webs.registryName, "server.json registry name mismatch");
	assert(
		server.remotes?.[0]?.url === webs.mcp.url,
		"server.json remote URL mismatch",
	);
	assert(
		server.remotes?.[0]?.type === webs.mcp.transport,
		"server.json remote transport mismatch",
	);

	const codex = readJson<PluginManifest>(".codex-plugin/plugin.json");
	const claude = readJson<PluginManifest>(".claude-plugin/plugin.json");
	const cursor = readJson<PluginManifest>(".cursor-plugin/plugin.json");
	const codexMarketplace = readJson<CodexMarketplace>(
		".agents/plugins/marketplace.json",
	);

	for (const [label, manifest] of [
		["codex", codex],
		["claude", claude],
		["cursor", cursor],
	] as const) {
		assert(manifest.name === webs.name, `${label} manifest name mismatch`);
		assert(manifest.skills === "./skills", `${label} manifest skills path mismatch`);
		assert(
			manifest.mcpServers === "./.mcp.json",
			`${label} manifest MCP path mismatch`,
		);
		if (label !== "codex") {
			checkPluginMetadata(`${label} manifest`, manifestMetadata(manifest));
		}
		assert(manifest.hooks === undefined, `${label} manifest must not add hooks`);
	}
	assert(
		Array.isArray(codex.interface?.capabilities),
		"codex manifest is missing interface capabilities",
	);
	assert(
		Array.isArray(codex.interface?.defaultPrompt),
		"codex manifest is missing default prompts",
	);
	assert(
		codex.interface?.metadata === undefined,
		"codex manifest must not include unsupported interface metadata",
	);
	assert(codexMarketplace.name === webs.name, "codex marketplace name mismatch");
	assert(
		codexMarketplace.interface?.displayName === webs.displayName,
		"codex marketplace display name mismatch",
	);
	assert(
		codexMarketplace.plugins?.length === 1,
		"codex marketplace must contain exactly one plugin",
	);
	const codexMarketplacePlugin = codexMarketplace.plugins[0];
	assert(
		codexMarketplacePlugin?.name === webs.name,
		"codex marketplace plugin name mismatch",
	);
	assert(
		JSON.stringify(codexMarketplacePlugin.source) ===
			JSON.stringify({
				source: webs.codex.marketplace.source,
				url: `${webs.repository}.git`,
				ref: webs.codex.marketplace.ref,
			}),
		"codex marketplace source mismatch",
	);
	assert(
		JSON.stringify(codexMarketplacePlugin.policy) ===
			JSON.stringify(webs.codex.marketplace.policy),
		"codex marketplace policy mismatch",
	);
	assert(
		codexMarketplacePlugin.category === webs.category,
		"codex marketplace category mismatch",
	);

	const claudeMarketplace = readJson<MarketplaceManifest>(
		".claude-plugin/marketplace.json",
	);
	const cursorMarketplace = readJson<MarketplaceManifest>(
		".cursor-plugin/marketplace.json",
	);
	checkPluginMetadata(
		"claude marketplace",
		(claudeMarketplace.plugins?.[0]?.metadata ?? {}) as PluginMetadata,
	);
	checkPluginMetadata(
		"cursor marketplace",
		(cursorMarketplace.metadata ?? {}) as PluginMetadata,
	);

	assert(expectedToolNames.length === 7, "Webs must expose exactly seven tools");
	assert(expectedOAuthScopes.length === 9, "Webs must publish exactly nine OAuth scopes");
	assert(
		!expectedOAuthScopes.some((scope) => scope === ("readiness" as string)),
		"readiness is a tool, not an OAuth scope",
	);
	const readiness = webs.tools.find((tool) => tool.name === "readiness");
	assert(
		JSON.stringify(readiness?.protectedBy) === JSON.stringify(["read"]),
		"readiness must be protected by the read scope",
	);
}

function checkPluginMetadata(label: string, metadata: PluginMetadata) {
	const toolNames = (metadata.tools ?? []).map((tool) => tool.name).sort();
	assert(
		JSON.stringify(toolNames) === JSON.stringify(expectedToolNames),
		`${label} tool list mismatch`,
	);
	assert(
		JSON.stringify(metadata.tools) === JSON.stringify(expectedToolMetadata),
		`${label} tool protection metadata mismatch`,
	);
	assert(
		JSON.stringify(metadata.oauthScopes) === JSON.stringify(expectedOAuthScopes),
		`${label} OAuth scope list mismatch`,
	);
	assert(
		metadata.repoProfile === "agent-plugin-companion",
		`${label} missing repo profile metadata`,
	);
	assert(metadata.companionOf === "webs", `${label} companion mismatch`);
}

function checkSkillFrontmatter() {
	for (const skill of webs.skills) {
		const rel = `skills/${skill.name}/SKILL.md`;
		const path = join(ROOT, rel);
		assert(existsSync(path), `${rel} is missing`);
		const text = readFileSync(path, "utf8");
		assert(text.startsWith("---\n"), `${rel} is missing YAML frontmatter`);
		const end = text.indexOf("\n---", 4);
		assert(end > 0, `${rel} frontmatter is not closed`);
		const frontmatter = text.slice(4, end);
		assert(
			frontmatter.includes(`name: ${skill.name}`),
			`${rel} frontmatter name mismatch`,
		);
		assert(
			frontmatter.includes("description:"),
			`${rel} frontmatter missing description`,
		);
		for (const alias of skill.aliases) {
			assert(frontmatter.includes(alias), `${rel} missing alias ${alias}`);
		}
	}
}

function checkPublicContractCopy() {
	const publicFiles = [
		"webs.config.ts",
		"webs-connect.generated.ts",
		"README.md",
		".npmrc",
		".github/workflows/verify.yml",
		"extensions/schemas.ts",
		"extensions/transport.ts",
		"extensions/webs.ts",
		"tooling/battery.ts",
		"tooling/run-battery.ts",
		"test/battery.test.ts",
		"test/webs.test.ts",
		...webs.skills.map((skill) => `skills/${skill.name}/SKILL.md`),
		".claude-plugin/plugin.json",
		".agents/plugins/marketplace.json",
		".codex-plugin/plugin.json",
		".cursor-plugin/plugin.json",
		...webs.connectClients.map((client) => {
			const filenames = {
				codex: "config.toml",
				claude: "add.sh",
				cursor: "mcp.json",
				windsurf: "mcp_config.json",
				vscode: "mcp.json",
				generic: "initialize.sh",
			} as const;
			return `clients/${client.id}/${filenames[client.id]}`;
		}),
	];
	const forbidden: Array<[RegExp, string]> = [
		[/\bwebs\.(?:read|search|fetch|save|recall|context|ask|watch|run|readiness)\b/i, "synthetic webs.* OAuth scope"],
		[/\bURL\(s\) or content\b/i, "URL-or-content save claim"],
		[/\bselected[- ]content\b/i, "selected-content save claim"],
		[/\bdistilled[- ]text\b/i, "distilled-text save claim"],
		[/\/Users\/luke\//, "private user path"],
		[/\/private\/tmp\/webs-pa\//, "private lane path"],
		[/~\/\.agents(?:\/|\b)/, "private agent-runtime path"],
		[/\bgh[opsu]_[A-Za-z0-9]{20,}\b/, "GitHub token"],
		[/\bwebs_mcp_[A-Za-z0-9]{24,}\b/, "Webs MCP token"],
	];

	for (const rel of publicFiles) {
		const text = readFileSync(join(ROOT, rel), "utf8");
		for (const [pattern, label] of forbidden) {
			assert(!pattern.test(text), `${rel} contains unsupported ${label}`);
		}
	}

	const readme = readFileSync(join(ROOT, "README.md"), "utf8");
	assert(
		readme.includes("### Quickstart: authenticate and verify"),
		"README is missing the generated auth/readiness quickstart",
	);
	assert(
		readme.includes('{"urls":["https://example.com"],"task":"...","why":"..."}'),
		"README is missing the URL-only save round trip",
	);
	assert(
		readme.includes(
			"pi install git:github.com/creative-int/webs-plugins",
		),
		"README is missing the generated Pi install command",
	);
	assert(
		readme.includes("webs login --profile prod"),
		"README is missing Pi OAuth guidance",
	);
	assert(
		readme.includes(
			"codex plugin marketplace add creative-int/webs-plugins",
		),
		"README is missing the Codex marketplace add command",
	);
	assert(
		readme.includes("codex plugin add webs@webs"),
		"README is missing the Codex plugin add command",
	);
	assert(
		readme.includes(
			'[mcp_servers.webs]\nurl = "https://webs.creative-int.com/mcp"',
		),
		"README is missing the Codex direct-MCP TOML block",
	);
	assert(
		readme.includes(
			"claude mcp add --scope user --transport http webs 'https://webs.creative-int.com/mcp'",
		),
		"README is missing the Claude direct-MCP command",
	);
}

function readJson<T>(rel: string): T {
	const path = join(ROOT, rel);
	assert(existsSync(path), `${rel} is missing`);
	return JSON.parse(readFileSync(path, "utf8")) as T;
}

function manifestMetadata(manifest: PluginManifest): PluginMetadata {
	return (manifest.metadata ?? manifest.interface?.metadata ?? {}) as PluginMetadata;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

interface PluginManifest {
	name?: string;
	skills?: string;
	mcpServers?: string;
	hooks?: unknown;
	metadata?: unknown;
	interface?: {
		capabilities?: unknown;
		defaultPrompt?: unknown;
		metadata?: unknown;
	};
}

interface MarketplaceManifest {
	metadata?: unknown;
	plugins?: Array<{ metadata?: unknown }>;
}

interface CodexMarketplace {
	name?: string;
	interface?: { displayName?: string };
	plugins: Array<{
		name?: string;
		source?: {
			source?: string;
			url?: string;
			ref?: string;
		};
		policy?: {
			installation?: string;
			authentication?: string;
		};
		category?: string;
	}>;
}

interface PluginMetadata {
	repoProfile?: string;
	companionOf?: string;
	oauthScopes?: string[];
	tools?: Array<{
		name: string;
		protectedBy: string[];
		description: string;
	}>;
}
