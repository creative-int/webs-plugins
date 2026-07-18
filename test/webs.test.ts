import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import createWebsPiExtension, {
	createWebsTransport,
	websToolContracts,
	type WebsToolArguments,
	type WebsToolName,
	type WebsTransport,
} from "../extensions/webs.ts";

interface ToolResult {
	content: Array<{ text: string; type: string }>;
	details: Record<string, unknown>;
	isError?: boolean;
}

interface RegisteredTool {
	description: string;
	name: string;
	parameters: Record<string, unknown>;
	execute(
		id: string,
		params: WebsToolArguments,
		signal?: AbortSignal,
	): Promise<ToolResult>;
}

const expectedNames = [
	"readiness",
	"save",
	"recall",
	"context",
	"ask",
	"watch",
	"run",
] as const;

test("registers exactly the production seven-tool surface without hooks", () => {
	const { hooks, tools } = register({
		async callTool() {
			return {};
		},
	});

	assert.deepEqual(
		tools.map((tool) => tool.name),
		expectedNames,
	);
	assert.equal(hooks(), 0);
	assert.equal(new Set(tools.map((tool) => tool.name)).size, 7);
});

test("mirrors production schema requirements, bounds, enums, feedback, scopes, and polling", () => {
	const schemas = Object.fromEntries(
		websToolContracts.map((tool) => [tool.name, tool.parameters]),
	) as unknown as Record<WebsToolName, Record<string, unknown>>;
	const save = schemas.save as Schema;
	const recall = schemas.recall as Schema;
	const context = schemas.context as Schema;
	const ask = schemas.ask as Schema;
	const watch = schemas.watch as Schema;
	const run = schemas.run as Schema;

	assert.deepEqual(save.required, ["urls", "task", "why"]);
	assert.deepEqual(save.properties.urls, {
		type: "array",
		items: { type: "string", format: "uri" },
		minItems: 1,
		maxItems: 8,
	});
	assert.deepEqual(save.properties.via.enum, ["mcp", "extension"]);
	assert.deepEqual(recall.properties.limit, {
		type: "number",
		minimum: 1,
		maximum: 25,
		description: "Max results (default 8).",
	});
	assert.deepEqual(recall.properties.feedback.required, ["action"]);
	assert.equal(
		recall.properties.feedback.properties.context.additionalProperties,
		true,
	);
	assert.deepEqual(context.required, ["task"]);
	assert.equal(context.properties.scope.additionalProperties, false);
	assert.deepEqual(ask.required, ["question", "mode"]);
	assert.deepEqual(ask.properties.mode.enum, [
		"saved_only",
		"saved_memory",
		"fresh_then_saved",
	]);
	assert.deepEqual(ask.properties.citationStyle.enum, [
		"inline",
		"footnote",
		"json",
	]);
	assert.deepEqual(ask.properties.scope.properties.watchIds, {
		type: "array",
		items: { type: "string" },
	});
	assert.equal(watch.properties.sourceUrls.maxItems, 5);
	assert.equal(watch.properties.limit.maximum, 50);
	assert.deepEqual(run.properties.mode.enum, [
		"research",
		"compare",
		"monitor_snapshot",
	]);
	assert.deepEqual(run.anyOf, [
		{ required: ["runId"] },
		{ required: ["task", "mode"] },
	]);
	for (const schema of Object.values(schemas)) {
		assert.equal(schema.additionalProperties, false);
	}
});

test("preserves arguments and returns readable text with structured details", async () => {
	const calls: Array<{
		args: WebsToolArguments;
		name: WebsToolName;
		signal?: AbortSignal;
	}> = [];
	const transport: WebsTransport = {
		async callTool(name, args, signal) {
			calls.push({ name, args, signal });
			return { answer: 42, citations: ["web_123"] };
		},
	};
	const { tools } = register(transport);
	const input = {
		feedback: {
			action: "flag",
			context: { source: "pi" },
			reason: "not_useful",
		},
		query: "What did we decide?",
	};
	const controller = new AbortController();
	const result = await tool(tools, "recall").execute(
		"call_1",
		input,
		controller.signal,
	);

	assert.deepEqual(calls, [
		{ name: "recall", args: input, signal: controller.signal },
	]);
	assert.match(result.content[0]?.text ?? "", /"answer": 42/);
	assert.deepEqual(result.details, {
		ok: true,
		result: { answer: 42, citations: ["web_123"] },
		tool: "recall",
	});
});

test("missing and expired auth return a readable login remedy", async () => {
	const missingDir = mkdtempSync(join(tmpdir(), "webs-pi-missing-"));
	const missingTransport = createWebsTransport({
		configPath: join(missingDir, "config.json"),
		env: {},
	});
	const missing = await tool(register(missingTransport).tools, "readiness").execute(
		"call_missing",
		{},
	);
	assert.equal(missing.isError, true);
	assert.match(missing.content[0]?.text ?? "", /webs login --profile prod/);
	assert.equal(errorKind(missing), "auth");

	const expiredPath = join(
		mkdtempSync(join(tmpdir(), "webs-pi-expired-")),
		"config.json",
	);
	writeFileSync(
		expiredPath,
		JSON.stringify({
			currentProfile: "work",
			profiles: {
				work: {
					expiresAt: "2000-01-01T00:00:00.000Z",
					token: "expired-secret",
				},
			},
		}),
	);
	const expiredTransport = createWebsTransport({
		configPath: expiredPath,
		env: {},
		now: () => Date.parse("2026-07-18T00:00:00.000Z"),
	});
	const expired = await tool(register(expiredTransport).tools, "readiness").execute(
		"call_expired",
		{},
	);
	assert.match(expired.content[0]?.text ?? "", /credentials have expired/);
	assert.match(expired.content[0]?.text ?? "", /webs login --profile work/);
	assert.doesNotMatch(JSON.stringify(expired), /expired-secret/);
});

test("reuses the selected Webs CLI profile token and base URL", async () => {
	const profilePath = join(
		mkdtempSync(join(tmpdir(), "webs-pi-profile-")),
		"config.json",
	);
	writeFileSync(
		profilePath,
		JSON.stringify({
			currentProfile: "work",
			profiles: {
				work: {
					baseUrl: "https://work.webs.example/custom",
					expiresAt: "2999-01-01T00:00:00.000Z",
					token: "profile-secret",
				},
			},
		}),
	);
	const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
	const transport = createWebsTransport({
		configPath: profilePath,
		env: {},
		fetch: (async (input, init) => {
			requests.push({ input, init });
			return Response.json({
				id: 1,
				jsonrpc: "2.0",
				result: { structuredContent: { ready: true } },
			});
		}) as typeof fetch,
	});
	const result = await tool(register(transport).tools, "readiness").execute(
		"call_profile",
		{},
	);

	assert.equal(requests[0]?.input, "https://work.webs.example/custom/mcp");
	assert.equal(
		(requests[0]?.init?.headers as Record<string, string>).authorization,
		"Bearer profile-secret",
	);
	assert.deepEqual(result.details, {
		ok: true,
		result: { ready: true },
		tool: "readiness",
	});
	assert.doesNotMatch(JSON.stringify(result), /profile-secret/);
});

test("malformed config fails without echoing file contents or credentials", async () => {
	const malformedPath = join(
		mkdtempSync(join(tmpdir(), "webs-pi-malformed-")),
		"config.json",
	);
	writeFileSync(malformedPath, '{"token":"malformed-secret",');
	const transport = createWebsTransport({ configPath: malformedPath, env: {} });
	const result = await tool(register(transport).tools, "readiness").execute(
		"call_malformed",
		{},
	);

	assert.equal(result.isError, true);
	assert.equal(errorKind(result), "config");
	assert.match(result.content[0]?.text ?? "", /valid Webs CLI config/);
	assert.doesNotMatch(JSON.stringify(result), /malformed-secret/);
	assert.doesNotMatch(JSON.stringify(result), /\{"token"/);
});

test("HTTP auth failure is bounded, redacted, and points to login", async () => {
	const secret = "webs_mcp_http_secret";
	const transport = createWebsTransport({
		env: {
			WEBS_MCP_TOKEN: secret,
			WEBS_MCP_URL: "https://webs.example/mcp",
		},
		fetch: (async () =>
			new Response(`unauthorized Bearer ${secret} ${"x".repeat(2_000)}`, {
				status: 401,
			})) as typeof fetch,
	});
	const result = await tool(register(transport).tools, "recall").execute(
		"call_401",
		{ query: "memory" },
	);

	assert.equal(result.isError, true);
	assert.equal(errorKind(result), "auth");
	assert.match(result.content[0]?.text ?? "", /HTTP 401/);
	assert.match(result.content[0]?.text ?? "", /webs login --profile prod/);
	assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
	assert.ok((result.content[0]?.text.length ?? 0) < 700);
});

test("JSON-RPC failure is typed and never leaks the bearer", async () => {
	const secret = "webs_mcp_rpc_secret";
	const transport = createWebsTransport({
		env: {
			WEBS_MCP_TOKEN: secret,
			WEBS_MCP_URL: "https://webs.example/mcp",
		},
		fetch: (async () =>
			Response.json({
				error: { code: -32_000, message: `bad request for ${secret}` },
				id: 1,
				jsonrpc: "2.0",
			})) as typeof fetch,
	});
	const result = await tool(register(transport).tools, "ask").execute(
		"call_rpc",
		{ mode: "saved_only", question: "Why?" },
	);

	assert.equal(result.isError, true);
	assert.equal(errorKind(result), "mcp");
	assert.equal(
		((result.details.error as Record<string, unknown>)?.code as number),
		-32_000,
	);
	assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test("parses SSE JSON-RPC and preserves the direct tools/call payload", async () => {
	const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
	const transport = createWebsTransport({
		env: {
			WEBS_MCP_TOKEN: "sse-secret",
			WEBS_MCP_URL: "https://webs.example/custom-mcp",
		},
		fetch: (async (input, init) => {
			requests.push({ input, init });
			return new Response(
				`event: message\ndata: ${JSON.stringify({
					id: 1,
					jsonrpc: "2.0",
					result: {
						content: [{ type: "text", text: '{"runId":"run_123","pollAfterMs":750}' }],
						structuredContent: { runId: "run_123", pollAfterMs: 750 },
					},
				})}\n\ndata: [DONE]\n\n`,
				{ headers: { "content-type": "text/event-stream" } },
			);
		}) as typeof fetch,
	});
	const input = { runId: "run_123" };
	const result = await tool(register(transport).tools, "run").execute(
		"call_sse",
		input,
	);

	assert.deepEqual(result.details, {
		ok: true,
		result: { runId: "run_123", pollAfterMs: 750 },
		tool: "run",
	});
	assert.equal(requests[0]?.input, "https://webs.example/custom-mcp");
	const body = JSON.parse(String(requests[0]?.init?.body)) as Record<
		string,
		unknown
	>;
	assert.deepEqual(body, {
		id: 1,
		jsonrpc: "2.0",
		method: "tools/call",
		params: { arguments: input, name: "run" },
	});
});

test("rejects an SSE response without a JSON-RPC payload", async () => {
	const transport = createWebsTransport({
		env: {
			WEBS_MCP_TOKEN: "empty-sse-secret",
			WEBS_MCP_URL: "https://webs.example/mcp",
		},
		fetch: (async () =>
			new Response("event: ping\n\ndata: [DONE]\n\n", {
				headers: { "content-type": "text/event-stream" },
			})) as typeof fetch,
	});
	const result = await tool(register(transport).tools, "readiness").execute(
		"call_empty_sse",
		{},
	);

	assert.equal(result.isError, true);
	assert.equal(errorKind(result), "mcp");
	assert.match(result.content[0]?.text ?? "", /without a JSON-RPC payload/);
	assert.doesNotMatch(JSON.stringify(result), /empty-sse-secret/);
});

test("does not truncate successful long-form MCP text", async () => {
	const longText = "memory ".repeat(300);
	const transport: WebsTransport = {
		async callTool() {
			return longText;
		},
	};
	const result = await tool(register(transport).tools, "context").execute(
		"call_long",
		{ task: "Use memory" },
	);

	assert.equal(result.content[0]?.text, longText);
	assert.equal(result.details.result, longText);
});

test("classifies abort and network failures without exposing causes", async () => {
	const env = {
		WEBS_MCP_TOKEN: "network-secret",
		WEBS_MCP_URL: "https://webs.example/mcp",
	};
	const controller = new AbortController();
	controller.abort();
	const aborted = createWebsTransport({
		env,
		fetch: (async () => {
			throw new DOMException("aborted", "AbortError");
		}) as typeof fetch,
	});
	const abortResult = await tool(register(aborted).tools, "readiness").execute(
		"call_abort",
		{},
		controller.signal,
	);
	assert.equal(errorKind(abortResult), "abort");
	assert.match(abortResult.content[0]?.text ?? "", /cancelled/);

	const network = createWebsTransport({
		env,
		fetch: (async () => {
			throw new Error("socket failed with network-secret");
		}) as typeof fetch,
	});
	const networkResult = await tool(
		register(network).tools,
		"readiness",
	).execute("call_network", {});
	assert.equal(errorKind(networkResult), "network");
	assert.match(networkResult.content[0]?.text ?? "", /Unable to reach/);
	assert.doesNotMatch(JSON.stringify(networkResult), /network-secret/);
});

function register(transport: WebsTransport): {
	hooks: () => number;
	tools: RegisteredTool[];
} {
	const tools: RegisteredTool[] = [];
	let hookCalls = 0;
	const pi = {
		on() {
			hookCalls += 1;
		},
		registerTool(value: unknown) {
			tools.push(value as RegisteredTool);
		},
	};
	createWebsPiExtension(transport)(pi as unknown as ExtensionAPI);
	return { hooks: () => hookCalls, tools };
}

function tool(tools: RegisteredTool[], name: WebsToolName): RegisteredTool {
	const found = tools.find((candidate) => candidate.name === name);
	assert.ok(found, `missing tool ${name}`);
	return found;
}

function errorKind(result: ToolResult): string | undefined {
	return (result.details.error as Record<string, unknown> | undefined)?.kind as
		| string
		| undefined;
}

interface Schema extends Record<string, unknown> {
	additionalProperties: boolean;
	anyOf: unknown[];
	properties: Record<string, Schema>;
	required: string[];
	enum: string[];
	items: Schema;
	maximum: number;
	maxItems: number;
}
