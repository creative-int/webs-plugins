/**
 * Snapshot the public, generated Webs MCP client manifest into this companion.
 *
 * Usage:
 *   pnpm sync:webs-connect -- --source /path/to/webs/manifests/mcp-client-connect.json
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceFlag = process.argv.indexOf("--source");
const source =
	sourceFlag >= 0 ? process.argv[sourceFlag + 1] : process.env.WEBS_CONNECT_MANIFEST;

if (!source) {
	throw new Error(
		"Provide --source /path/to/webs/manifests/mcp-client-connect.json.",
	);
}

const sourcePath = resolve(source);
const raw = readFileSync(sourcePath, "utf8");
const manifest = JSON.parse(raw) as {
	clients?: Array<{ id?: string; value?: string }>;
	server?: { transport?: string; url?: string };
	tools?: string[];
};
const clientIds = manifest.clients?.map((client) => client.id);

if (
	manifest.server?.transport !== "streamable-http" ||
	typeof manifest.server.url !== "string"
) {
	throw new Error("Webs connect manifest has an invalid server contract.");
}
if (
	!clientIds ||
	JSON.stringify(clientIds) !==
		JSON.stringify([
			"codex",
			"claude",
			"cursor",
			"windsurf",
			"vscode",
			"generic",
		])
) {
	throw new Error("Webs connect manifest does not contain the canonical six clients.");
}
if (raw.match(/Bearer\s+webs_(?!__WEBS_API_TOKEN__)/u)) {
	throw new Error("Refusing to snapshot a manifest that appears to contain a token.");
}

const digest = createHash("sha256").update(raw).digest("hex");
const output = `/**
 * Generated from creative-int/webs manifests/mcp-client-connect.json.
 * Source SHA-256: ${digest}
 * Run \`pnpm sync:webs-connect -- --source <manifest>\`; do not edit by hand.
 */
export const websConnect = ${JSON.stringify(
	{
		sourceDigest: digest,
		sourcePath: "creative-int/webs:manifests/mcp-client-connect.json",
		...manifest,
	},
	null,
	2,
)} as const;
`;

writeFileSync(resolve("webs-connect.generated.ts"), output);
console.log(`synced Webs connect manifest (${digest.slice(0, 12)})`);
