/**
 * Deterministic smoke for the Webs plugin companion repo.
 *
 * Validates generated manifests, MCP metadata shape, and skill frontmatter.
 * It deliberately does not require a bearer token.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
const expectedScopes = webs.tools.map((tool) => tool.scope).sort();

try {
	checkGeneratedManifestShape();
	checkSkillFrontmatter();
	console.log(
		`Webs plugin smoke OK: ${expectedToolNames.length} tools, ${expectedSkillNames.length} skills.`,
	);
} catch (error) {
	console.error(`Webs plugin smoke failed: ${(error as Error).message}`);
	process.exit(1);
}

function checkGeneratedManifestShape() {
	const mcp = readJson<{ mcpServers?: Record<string, { url?: string; transport?: string }> }>(
		".mcp.json",
	);
	const mcpServer = mcp.mcpServers?.[webs.mcp.id];
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
		const metadata = manifestMetadata(manifest);
		const toolNames = (metadata.tools ?? []).map((tool) => tool.name).sort();
		const scopes = [...(metadata.scopes ?? [])].sort();
		assert(
			JSON.stringify(toolNames) === JSON.stringify(expectedToolNames),
			`${label} manifest tool list mismatch`,
		);
		assert(
			JSON.stringify(scopes) === JSON.stringify(expectedScopes),
			`${label} manifest scope list mismatch`,
		);
		assert(
			metadata.repoProfile === "agent-plugin-companion",
			`${label} manifest missing repo profile metadata`,
		);
		assert(metadata.companionOf === "webs", `${label} manifest companion mismatch`);
	}
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
	metadata?: unknown;
	interface?: { metadata?: unknown };
}

interface PluginMetadata {
	repoProfile?: string;
	companionOf?: string;
	scopes?: string[];
	tools?: Array<{ name: string; scope: string; description: string }>;
}
