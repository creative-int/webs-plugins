/**
 * Canonical source of truth for every Webs install adapter.
 *
 * One config in, every client manifest out. Run `pnpm generate` to emit
 * `.mcp.json`, Cursor / Codex / Claude Code plugin manifests, MCP Registry
 * `server.json`, and the README install block. Never hand-edit generated files.
 */

export interface WebsConfig {
	/** Machine-facing id (plugin name, MCP server key). */
	name: string;
	/** Human-facing name. */
	displayName: string;
	version: string;
	tagline: string;
	shortDescription: string;
	longDescription: string;
	homepage: string;
	repository: string;
	license: string;
	owner: { name: string; email: string };
	category: string;
	keywords: string[];
	logo: string;
	mcp: {
		id: string;
		url: string;
		transport: "streamable-http";
	};
	registryName: string;
	tools: Array<{
		name: "save" | "recall" | "context" | "ask" | "watch" | "run" | "readiness";
		scope: string;
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

export const webs: WebsConfig = {
	name: "webs",
	displayName: "Webs",
	version: "0.1.0",
	tagline: "Give your agents the web as memory.",
	shortDescription:
		"Connect agents to Webs memory over remote MCP: save, recall, ask, watch, run, readiness, and on-demand context.",
	longDescription:
		"Webs is where the web becomes memory. The remote MCP server gives agents the same memory surface humans use: save durable web findings with task and why, recall saved memory with citations, ask questions over memory, create monitors, run durable research, check readiness, and request small task-affinity context packets. The context verb is strictly on demand; this plugin teaches judgment rather than automatic prompt injection.",
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
	registryName: "io.github.creative-int/webs",
	tools: [
		{
			name: "save",
			scope: "webs.save",
			description:
				"Save URL(s) or content into analyzed Webs memory. Agent deposits carry task and why.",
		},
		{
			name: "recall",
			scope: "webs.recall",
			description:
				"Retrieve saved memory with hybrid semantic and lexical search, citations, excerpts, and scores.",
		},
		{
			name: "context",
			scope: "webs.context",
			description:
				"Return a small on-demand task-affinity context packet for an agent. Never automatic injection.",
		},
		{
			name: "ask",
			scope: "webs.ask",
			description:
				"Answer questions over saved memory with citations and modes for saved-only, saved-memory, or fresh-then-saved.",
		},
		{
			name: "watch",
			scope: "webs.watch",
			description:
				"Create or list monitors that keep standing topics feeding memory.",
		},
		{
			name: "run",
			scope: "webs.run",
			description:
				"Start durable research, compare, or monitor-snapshot runs and return a poll contract.",
		},
		{
			name: "readiness",
			scope: "webs.readiness",
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
			description: "Save durable findings with task and why.",
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
};

export default webs;
