/**
 * Canonical source of truth for every Webs install adapter.
 *
 * One config in, every client manifest out. Run `pnpm generate` to emit
 * `.mcp.json`, Cursor / Codex / Claude Code plugin manifests, MCP Registry
 * `server.json`, and the README install block. Never hand-edit generated files.
 */

export type WebsToolName =
	| "save"
	| "recall"
	| "context"
	| "ask"
	| "watch"
	| "run"
	| "readiness";

export type WebsOAuthScope =
	| "read"
	| "search"
	| "fetch"
	| "save"
	| "recall"
	| "context"
	| "ask"
	| "watch"
	| "run";

export interface WebsConfig {
	/** Machine-facing id (plugin name, MCP server key). */
	name: "webs";
	/** Human-facing name. */
	displayName: "Webs";
	version: string;
	tagline: string;
	shortDescription: string;
	longDescription: string;
	homepage: string;
	repository: "https://github.com/creative-int/webs-plugins";
	license: string;
	owner: { name: string; email: string };
	category: "Productivity";
	keywords: string[];
	logo: string;
	mcp: {
		id: string;
		url: string;
		transport: "streamable-http";
	};
	pi: {
		extensions: string[];
		skills: string[];
	};
	codex: {
		marketplace: {
			source: "url";
			ref: "main";
			policy: {
				installation: "AVAILABLE";
				authentication: "ON_INSTALL";
			};
		};
	};
	registryName: string;
	oauthScopes: WebsOAuthScope[];
	tools: Array<{
		name: WebsToolName;
		protectedBy: WebsOAuthScope[];
		description: string;
	}>;
	readiness: {
		status: string;
	};
	skills: Array<{
		name: string;
		aliases: string[];
		description: string;
	}>;
}

export const webs = {
	name: "webs",
	displayName: "Webs",
	version: "0.1.0",
	tagline: "Give your agents the web as memory.",
	shortDescription:
		"Connect agents to Webs memory over remote MCP: save, recall, ask, watch, run, readiness, and on-demand context.",
	longDescription:
		"Webs is where the web becomes memory. The remote MCP server gives agents the same memory surface humans use: save source URLs with task and why, recall saved memory with citations, ask questions over memory, create monitors, run durable research, check readiness, and request small task-affinity context packets. The context verb is strictly on demand; this plugin teaches judgment rather than automatic prompt injection.",
	homepage: "https://webs.creative-int.com",
	repository: "https://github.com/creative-int/webs-plugins",
	license: "MIT",
	owner: { name: "creative-int", email: "support@creative-int.com" },
	category: "Productivity",
	keywords: [
		"webs",
		"mcp",
		"memory",
		"recall",
		"agent-context",
		"research",
		"citations",
	],
	logo: "./assets/logo.png",
	mcp: {
		id: "webs",
		url: "https://webs.creative-int.com/mcp",
		transport: "streamable-http",
	},
	pi: {
		extensions: ["./extensions/index.ts"],
		skills: ["./skills"],
	},
	codex: {
		marketplace: {
			source: "url",
			ref: "main",
			policy: {
				installation: "AVAILABLE",
				authentication: "ON_INSTALL",
			},
		},
	},
	registryName: "io.github.creative-int/webs",
	oauthScopes: [
		"read",
		"search",
		"fetch",
		"save",
		"recall",
		"context",
		"ask",
		"watch",
		"run",
	],
	tools: [
		{
			name: "save",
			protectedBy: ["save"],
			description:
				"Save one to eight source URLs into analyzed Webs memory. Agent deposits require task and why.",
		},
		{
			name: "recall",
			protectedBy: ["recall"],
			description:
				"Retrieve saved memory with hybrid semantic and lexical search, citations, excerpts, and scores.",
		},
		{
			name: "context",
			protectedBy: ["context", "recall"],
			description:
				"Return a small on-demand task-affinity context packet for an agent. Never automatic injection.",
		},
		{
			name: "ask",
			protectedBy: ["ask"],
			description:
				"Answer questions over saved memory with citations and modes for saved-only, saved-memory, or fresh-then-saved.",
		},
		{
			name: "watch",
			protectedBy: ["watch"],
			description:
				"Create or list monitors that keep standing topics feeding memory.",
		},
		{
			name: "run",
			protectedBy: ["run"],
			description:
				"Start durable research, compare, or monitor-snapshot runs and return a poll contract.",
		},
		{
			name: "readiness",
			protectedBy: ["read"],
			description:
				"Probe auth, entitlement, scope, and tool availability for the Webs MCP connection.",
		},
	],
	readiness: {
		status:
			"Remote MCP endpoint configured at https://webs.creative-int.com/mcp. Auth is client-owned; bearer tokens stay in client credential stores or environment variables, never in this repository.",
	},
	skills: [
		{
			name: "webs-memory",
			aliases: ["webs", "memory", "have-we-seen"],
			description: "Judgment rule for deciding when to use Webs memory.",
		},
		{
			name: "webs-save",
			aliases: ["save-memory", "webs-save"],
			description: "Save durable source URLs with task and why.",
		},
		{
			name: "webs-recall-ask",
			aliases: ["webs-recall", "webs-ask", "ask-memory"],
			description: "Choose recall versus ask versus fresh search.",
		},
		{
			name: "webs-context",
			aliases: ["agent-context", "context-packet"],
			description: "Request small on-demand context packets without hooks.",
		},
	],
} satisfies WebsConfig;

export default webs;
