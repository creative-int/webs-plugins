import { Type, type TSchema, type TUnsafe } from "typebox";
import type { WebsToolArguments, WebsToolName } from "./types.ts";

export interface WebsToolContract {
	description: string;
	label: string;
	name: WebsToolName;
	parameters: TUnsafe<WebsToolArguments>;
}

const schema = (value: Record<string, unknown>) =>
	Type.Unsafe<WebsToolArguments>(value as TSchema);

const feedbackSchema = {
	type: "object",
	properties: {
		action: { type: "string", enum: ["flag"] },
		webId: { type: "string" },
		query: { type: "string" },
		askText: { type: "string" },
		reason: { type: "string", enum: ["not_useful"] },
		context: { type: "object", additionalProperties: true },
	},
	required: ["action"],
	description:
		"Optional result feedback action. Use action='flag' with reason='not_useful' to record a saved battery case.",
} as const;

/** Exact public mirror of the production Webs v1Tools contract. */
export const websToolContracts: readonly WebsToolContract[] = [
	{
		name: "readiness",
		label: "Webs: Readiness",
		description:
			"Return account readiness for Webs spaces, saved URLs, monitors, API tokens, webhooks, and usage credits.",
		parameters: schema({
			type: "object",
			properties: {},
			additionalProperties: false,
		}),
	},
	{
		name: "save",
		label: "Webs: Save",
		description:
			"Save one or more URLs into Webs memory and queue analysis so the result can be recalled later. Returns saved web IDs and queued status.",
		parameters: schema({
			type: "object",
			properties: {
				urls: {
					type: "array",
					items: { type: "string", format: "uri" },
					minItems: 1,
					maxItems: 8,
				},
				prompt: {
					type: "string",
					description: "Optional analysis goal or focus instruction.",
				},
				task: {
					type: "string",
					description: "Required agent task or workflow that caused this save.",
				},
				why: {
					type: "string",
					description:
						"Required reason this URL should be remembered for later recall.",
				},
				spaceId: { type: "string", description: "Optional space ID." },
				space: {
					type: "string",
					description: "Optional space name, slug, or ID.",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Optional tags for organization.",
				},
				via: {
					type: "string",
					enum: ["mcp", "extension"],
					description:
						"Optional origin surface for MCP-backed saves. Extension clients pass extension.",
				},
				note: {
					type: "string",
					description: "Optional operator note saved alongside the web.",
				},
				idempotencyKey: {
					type: "string",
					description: "Optional stable key for deduplication.",
				},
			},
			required: ["urls", "task", "why"],
			additionalProperties: false,
		}),
	},
	{
		name: "recall",
		label: "Webs: Recall",
		description:
			"Retrieve saved Webs memory by query, web ID, or space. Returns results with scores, excerpts, and citation metadata. Uses hybrid semantic + lexical search.",
		parameters: schema({
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Optional natural-language search query.",
				},
				webId: {
					type: "string",
					description: "Optional exact saved web ID for full recall.",
				},
				spaceId: { type: "string", description: "Optional space ID filter." },
				space: {
					type: "string",
					description: "Optional space name, slug, or ID filter.",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 25,
					description: "Max results (default 8).",
				},
				includeMarkdown: {
					type: "boolean",
					description: "Include full markdown content when webId is specified.",
				},
				feedback: feedbackSchema,
				since: {
					type: "string",
					description:
						"Optional ISO timestamp filter — only results saved after this time.",
				},
			},
			additionalProperties: false,
		}),
	},
	{
		name: "context",
		label: "Webs: Context",
		description:
			"Return a small on-demand context packet for the caller's declared task. Ranks memory threads by ask-affinity, includes cited excerpts, and records thread use.",
		parameters: schema({
			type: "object",
			properties: {
				task: {
					type: "string",
					description: "Required task the caller is currently working on.",
				},
				why: {
					type: "string",
					description: "Optional reason this context is useful now.",
				},
				text: {
					type: "string",
					description:
						"Optional extra free text to match against memory threads.",
				},
				scope: {
					type: "object",
					properties: {
						spaceId: { type: "string" },
						space: { type: "string" },
						webIds: { type: "array", items: { type: "string" } },
					},
					description: "Optional memory scope filter.",
					additionalProperties: false,
				},
			},
			required: ["task"],
			additionalProperties: false,
		}),
	},
	{
		name: "ask",
		label: "Webs: Ask",
		description:
			"Answer a question using saved Webs memory, optional fresh fetch/search, and returned citations. Modes: saved_only uses already-saved web analysis; saved_memory uses semantic memory + agent recall; fresh_then_saved fetches fresh content first then falls back to saved memory.",
		parameters: schema({
			type: "object",
			properties: {
				question: {
					type: "string",
					description: "The question to answer using Webs memory.",
				},
				mode: {
					type: "string",
					enum: ["saved_only", "saved_memory", "fresh_then_saved"],
					description: "Retrieval mode.",
				},
				scope: {
					type: "object",
					properties: {
						spaceId: { type: "string" },
						space: { type: "string" },
						webIds: { type: "array", items: { type: "string" } },
						watchIds: { type: "array", items: { type: "string" } },
					},
					description: "Optional scope filter.",
				},
				task: {
					type: "string",
					description: "Optional task declaration for the ask.",
				},
				why: {
					type: "string",
					description: "Optional reason this ask matters for later memory.",
				},
				citationStyle: {
					type: "string",
					enum: ["inline", "footnote", "json"],
					description: "Citation format (default inline).",
				},
				feedback: feedbackSchema,
			},
			required: ["question", "mode"],
			additionalProperties: false,
		}),
	},
	{
		name: "watch",
		label: "Webs: Watch",
		description:
			"List existing monitors or create a new recurring monitor over important source URLs. Call with action='list' to view monitors; omit action or use action='create' to create one.",
		parameters: schema({
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["create", "list"],
					description:
						"create to make a new monitor; list to view existing monitors.",
				},
				name: {
					type: "string",
					description: "Monitor name (required for create).",
				},
				sourceUrls: {
					type: "array",
					items: { type: "string", format: "uri" },
					minItems: 1,
					maxItems: 5,
					description: "Source URLs to monitor (required for create).",
				},
				cadence: {
					type: "string",
					enum: ["daily", "weekly"],
					description: "How often to check (default weekly).",
				},
				spaceId: { type: "string", description: "Optional space ID." },
				goal: {
					type: "string",
					description: "Optional monitoring instructions.",
				},
				deliver: {
					type: "object",
					properties: {
						slack: { type: "boolean" },
						webhook: { type: "boolean" },
						digest: { type: "boolean" },
					},
					description: "Optional delivery channels (default digest: true).",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 50,
					description: "Max results for list action.",
				},
			},
			additionalProperties: false,
		}),
	},
	{
		name: "run",
		label: "Webs: Run",
		description:
			"Start or poll a named research, compare, or monitor-snapshot run. Pass runId by itself to poll an existing run. For new runs, pass task and mode; the result returns a durable runId and pollAfterMs.",
		parameters: schema({
			type: "object",
			properties: {
				runId: {
					type: "string",
					description:
						"Existing run ID to poll. When provided, task/mode/urls are ignored.",
				},
				task: {
					type: "string",
					description: "What to research, compare, or snapshot.",
				},
				mode: {
					type: "string",
					enum: ["research", "compare", "monitor_snapshot"],
					description: "Run mode.",
				},
				urls: {
					type: "array",
					items: { type: "string", format: "uri" },
					description: "Optional URLs to scope the run.",
				},
				query: { type: "string", description: "Optional search query." },
				spaceId: { type: "string", description: "Optional space ID." },
				save: {
					type: "boolean",
					description:
						"Whether to save the result to Webs memory (default true).",
				},
				idempotencyKey: {
					type: "string",
					description: "Optional stable key for deduplication.",
				},
			},
			anyOf: [{ required: ["runId"] }, { required: ["task", "mode"] }],
			additionalProperties: false,
		}),
	},
] as const;
