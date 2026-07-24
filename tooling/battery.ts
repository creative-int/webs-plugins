import {
	runJourney,
	type JourneyAdapter,
	type JourneyRunResult,
	type JourneyScenario,
	type JourneyStep,
} from "@creative-int/evals/journeys";
import {
	parseProofRun,
	scoreProofRun,
	type ProofAssertion,
	type ProofArtifact,
	type ProofRun,
	type ProofScoreResult,
} from "@creative-int/evals/proof";
import type {
	WebsToolArguments,
	WebsToolName,
	WebsTransport,
} from "../extensions/webs.ts";

export const WEBS_BATTERY_TOOL_SURFACE = [
	"readiness",
	"save",
	"recall",
	"context",
	"ask",
	"watch",
	"run",
] as const satisfies readonly WebsToolName[];

export const WEBS_BATTERY_JOURNEY_ORDER = [
	"readiness",
	"save",
	"recall",
	"context",
	"ask",
] as const satisfies readonly WebsToolName[];

export interface WebsBatteryCase {
	id: string;
	title: string;
	sourceUrl: string;
	task: string;
	why: string;
	query: string;
	question: string;
	idempotencyKey: string;
}

export const DEFAULT_WEBS_BATTERY_CASES = [
	{
		id: "agent-memory-roundtrip",
		title: "An agent can save and cite a durable source through Webs MCP",
		sourceUrl: "https://github.com/creative-int/webs-plugins",
		task: "Verify the public Webs agent companion memory journey",
		why: "The companion contract should remain recallable with source citations",
		query: "Webs plugins public agent companion",
		question: "Which source documents the public Webs agent companion?",
		idempotencyKey: "webs-plugins-agent-memory-roundtrip-v1",
	},
] as const satisfies readonly WebsBatteryCase[];

type BatteryStep = JourneyStep<WebsToolName, WebsToolArguments>;

interface BatteryObservation {
	result: unknown;
	tool: WebsToolName;
}

interface BatteryCall {
	args: WebsToolArguments;
	result: unknown;
	tool: WebsToolName;
}

interface BatteryContext {
	calls: BatteryCall[];
	savedWebId?: string;
}

interface BatteryState {
	calls: BatteryCall[];
	savedWebId?: string;
}

export interface WebsBatteryCaseResult {
	caseId: string;
	gate: JourneyRunResult<BatteryStep, BatteryObservation, BatteryState>["gate"];
	pass: boolean;
	proof: ProofRun;
	score: ProofScoreResult;
	trace: JourneyRunResult<
		BatteryStep,
		BatteryObservation,
		BatteryState
	>["trace"];
}

export interface RunWebsBatteryOptions {
	cases?: readonly WebsBatteryCase[];
	runIdPrefix?: string;
	transport: WebsTransport;
	transportKind?: "custom-webs-transport" | "deterministic-mcp-fixture" | "live-mcp";
}

export async function runWebsBattery(
	options: RunWebsBatteryOptions,
): Promise<WebsBatteryCaseResult[]> {
	const cases = options.cases ?? DEFAULT_WEBS_BATTERY_CASES;
	if (cases.length === 0) {
		throw new Error(
			"Webs MCP battery requires at least one case; zero-case runs fail closed.",
		);
	}

	const caseIds = new Set<string>();
	for (const batteryCase of cases) {
		if (!batteryCase.id.trim()) {
			throw new Error("Webs MCP battery case ids must be non-empty.");
		}
		if (caseIds.has(batteryCase.id)) {
			throw new Error(
				`Webs MCP battery case id is duplicated: ${batteryCase.id}`,
			);
		}
		caseIds.add(batteryCase.id);
	}

	const results: WebsBatteryCaseResult[] = [];
	for (const batteryCase of cases) {
		const run = await runBatteryCase(
			batteryCase,
			options.transport,
			options.runIdPrefix ?? "webs-mcp-battery",
			options.transportKind ?? "custom-webs-transport",
		);
		const proof = parseProofRun(run.proof);
		const score = scoreProofRun(proof);
		results.push({
			caseId: batteryCase.id,
			gate: run.gate,
			pass:
				run.gate.pass &&
				score.score === 1 &&
				score.blockers.length === 0,
			proof,
			score,
			trace: run.trace,
		});
	}
	return results;
}

async function runBatteryCase(
	batteryCase: WebsBatteryCase,
	transport: WebsTransport,
	runIdPrefix: string,
	transportKind: NonNullable<RunWebsBatteryOptions["transportKind"]>,
): Promise<JourneyRunResult<BatteryStep, BatteryObservation, BatteryState>> {
	const requiredAssertions = [
		"battery.surface.exact-seven",
		"battery.journey.tool-order",
		"battery.save.agent-intent",
		"battery.recall.citations",
		"battery.context.on-demand-citations",
		"battery.ask.citations",
	];
	const scenario: JourneyScenario<
		BatteryStep,
		undefined,
		undefined,
		BatteryObservation,
		BatteryState
	> = {
		id: batteryCase.id,
		title: batteryCase.title,
		tags: ["mcp", "agent-facing", "proof-run", "fail-closed"],
		steps: [
			{ id: "readiness", operation: "readiness", input: {} },
			{
				id: "save",
				operation: "save",
				input: {
					urls: [batteryCase.sourceUrl],
					task: batteryCase.task,
					why: batteryCase.why,
					idempotencyKey: batteryCase.idempotencyKey,
					via: "mcp",
				},
			},
			{
				id: "recall",
				operation: "recall",
				input: { query: batteryCase.query, limit: 8 },
			},
			{
				id: "context",
				operation: "context",
				input: {
					task: batteryCase.task,
					why: batteryCase.why,
					text: batteryCase.query,
				},
			},
			{
				id: "ask",
				operation: "ask",
				input: {
					question: batteryCase.question,
					mode: "saved_only",
					task: batteryCase.task,
					why: batteryCase.why,
					citationStyle: "json",
				},
			},
		],
		policy: {
			execution: "fail-fast",
			defaultStepTimeoutMs: 30_000,
			gate: {
				minimumScore: 1,
				requiredAssertions,
			},
		},
		scorers: [
			{
				id: "agent-memory-contract",
				scope: "journey",
				score: ({ finalState }) =>
					scoreAgentMemoryContract(finalState, batteryCase),
			},
		],
		proof: {
			repo: "creative-int/webs-plugins",
			packageVersions: { "@creative-int/evals": "1.8.0" },
			userGoal:
				"Prove the public agent-facing Webs MCP memory journey without skip-into-green.",
			agentRoute: "source-ingest",
			allowedTools: [...WEBS_BATTERY_TOOL_SURFACE],
			proofClass: "deterministic-proof",
			metadata: {
				batteryCaseId: batteryCase.id,
				transport: transportKind,
			},
		},
	};

	const adapter: JourneyAdapter<
		BatteryContext,
		BatteryStep,
		BatteryObservation,
		BatteryState
	> = {
		createContext: () => ({ calls: [] }),
		async execute({ context, step, signal }) {
			const args = argsForStep(step, context.savedWebId);
			const result = await transport.callTool(step.operation, args, signal);
			const call = { args, result, tool: step.operation };
			context.calls.push(call);
			if (step.operation === "save") {
				context.savedWebId = extractSavedWebId(result);
			}
			return {
				observation: { result, tool: step.operation },
				state: snapshotContext(context),
				artifacts: [stepProofArtifact(batteryCase.id, step, result)],
			};
		},
		snapshotState: (context) => snapshotContext(context),
	};

	return runJourney({
		scenario,
		adapter,
		runtime: {
			idFactory: () => `${runIdPrefix}-${batteryCase.id}`,
		},
	});
}

function argsForStep(
	step: BatteryStep,
	savedWebId: string | undefined,
): WebsToolArguments {
	const args = { ...step.input };
	if (!savedWebId) return args;
	if (step.operation === "recall") {
		return { ...args, webId: savedWebId };
	}
	if (step.operation === "context" || step.operation === "ask") {
		return {
			...args,
			scope: {
				...(isRecord(args.scope) ? args.scope : {}),
				webIds: [savedWebId],
			},
		};
	}
	return args;
}

function scoreAgentMemoryContract(
	state: BatteryState | undefined,
	batteryCase: WebsBatteryCase,
): ProofAssertion[] {
	const calls = state?.calls ?? [];
	const byTool = new Map(calls.map((call) => [call.tool, call]));
	const readiness = byTool.get("readiness");
	const save = byTool.get("save");
	const recall = byTool.get("recall");
	const context = byTool.get("context");
	const ask = byTool.get("ask");

	return [
		assertion(
			"battery.surface.exact-seven",
			hasExactToolSurface(readiness?.result),
			"Readiness reports the exact seven-tool Webs MCP surface.",
		),
		assertion(
			"battery.journey.tool-order",
			sameValues(
				calls.map((call) => call.tool),
				WEBS_BATTERY_JOURNEY_ORDER,
			),
			"The agent journey executes readiness, save, recall, context, then ask.",
		),
		assertion(
			"battery.save.agent-intent",
			save?.args.task === batteryCase.task &&
				save.args.why === batteryCase.why &&
				save.args.idempotencyKey === batteryCase.idempotencyKey,
			"Save carries task, why, and idempotencyKey.",
		),
		assertion(
			"battery.recall.citations",
			hasCitations(recall?.result),
			"Recall returns cited saved-memory evidence.",
		),
		assertion(
			"battery.context.on-demand-citations",
			context?.args.task === batteryCase.task &&
				context.args.why === batteryCase.why &&
				hasCitations(context.result),
			"Context is requested deliberately with task and why and returns citations.",
		),
		assertion(
			"battery.ask.citations",
			ask?.args.mode === "saved_only" && hasCitations(ask.result),
			"Ask returns a saved-memory answer with citations.",
		),
	];
}

function assertion(
	name: string,
	pass: boolean,
	message: string,
): ProofAssertion {
	return {
		name,
		status: pass ? "pass" : "fail",
		score: pass ? 1 : 0,
		message,
	};
}

function stepProofArtifact(
	caseId: string,
	step: BatteryStep,
	result: unknown,
): ProofArtifact {
	const citationCount = countCitations(result);
	const kind: ProofArtifact["kind"] =
		step.operation === "readiness"
			? "auth-checkpoint"
			: citationCount > 0
				? "citation"
				: "test-result";
	return {
		id: `${caseId}-${step.id}`,
		kind,
		label: `Webs MCP ${step.operation} normalized result`,
		metadata: {
			tool: step.operation,
			citationCount,
			containsSavedWebId: Boolean(extractSavedWebId(result)),
		},
	};
}

function hasExactToolSurface(value: unknown): boolean {
	const tools = findStringArray(value, "tools");
	return Boolean(
		tools &&
			new Set(tools).size === WEBS_BATTERY_TOOL_SURFACE.length &&
			sameValues(
				[...tools].sort(),
				[...WEBS_BATTERY_TOOL_SURFACE].sort(),
			),
	);
}

function hasCitations(value: unknown): boolean {
	return countCitations(value) > 0;
}

function countCitations(value: unknown): number {
	if (!value || typeof value !== "object") return 0;
	if (Array.isArray(value)) {
		return value.reduce((total, item) => total + countCitations(item), 0);
	}
	let count = 0;
	for (const [key, nested] of Object.entries(value)) {
		if (
			/citations?/i.test(key) &&
			((Array.isArray(nested) && nested.length > 0) ||
				(typeof nested === "string" && nested.trim().length > 0))
		) {
			count += Array.isArray(nested) ? nested.length : 1;
			continue;
		}
		count += countCitations(nested);
	}
	return count;
}

function findStringArray(value: unknown, key: string): string[] | undefined {
	if (!value || typeof value !== "object") return undefined;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findStringArray(item, key);
			if (found) return found;
		}
		return undefined;
	}
	for (const [name, nested] of Object.entries(value)) {
		if (
			name === key &&
			Array.isArray(nested) &&
			nested.every((item) => typeof item === "string")
		) {
			return nested;
		}
		const found = findStringArray(nested, key);
		if (found) return found;
	}
	return undefined;
}

function extractSavedWebId(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	if (Array.isArray(value)) {
		for (const item of value) {
			const id = extractSavedWebId(item);
			if (id) return id;
		}
		return undefined;
	}
	const record = value as Record<string, unknown>;
	for (const key of ["webId", "id"]) {
		if (typeof record[key] === "string" && record[key]) {
			return record[key];
		}
	}
	for (const key of ["webIds", "ids"]) {
		const values = record[key];
		if (Array.isArray(values) && typeof values[0] === "string" && values[0]) {
			return values[0];
		}
	}
	for (const nested of Object.values(record)) {
		const id = extractSavedWebId(nested);
		if (id) return id;
	}
	return undefined;
}

function snapshotContext(context: BatteryContext): BatteryState {
	return {
		calls: context.calls.map((call) => ({
			args: structuredClone(call.args),
			result: structuredClone(call.result),
			tool: call.tool,
		})),
		...(context.savedWebId ? { savedWebId: context.savedWebId } : {}),
	};
}

function sameValues(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createDeterministicWebsTransport(): WebsTransport {
	let saved:
		| {
				id: string;
				task: string;
				url: string;
				why: string;
		  }
		| undefined;

	return {
		async callTool(name, args) {
			switch (name) {
				case "readiness":
					return {
						ready: true,
						mcp: {
							scopes: [
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
							tools: [...WEBS_BATTERY_TOOL_SURFACE],
						},
					};
				case "save": {
					const urls = args.urls;
					if (
						!Array.isArray(urls) ||
						typeof urls[0] !== "string" ||
						typeof args.task !== "string" ||
						typeof args.why !== "string" ||
						typeof args.idempotencyKey !== "string"
					) {
						throw new Error(
							"Deterministic save requires urls, task, why, and idempotencyKey.",
						);
					}
					saved = {
						id: "web_fixture_agent_memory",
						task: args.task,
						url: urls[0],
						why: args.why,
					};
					return {
						status: "saved",
						webIds: [saved.id],
						idempotencyKey: args.idempotencyKey,
					};
				}
				case "recall":
					if (!saved) throw new Error("Recall ran before save.");
					return {
						results: [
							{
								webId: saved.id,
								title: "Webs plugins",
								excerpt: `${saved.task}: ${saved.why}`,
								citations: [{ url: saved.url, webId: saved.id }],
								score: 1,
							},
						],
					};
				case "context":
					if (!saved) throw new Error("Context ran before save.");
					return {
						task: args.task,
						threads: [
							{
								excerpt: `${saved.task}: ${saved.why}`,
								citations: [{ url: saved.url, webId: saved.id }],
							},
						],
						budget: { used: 1, limit: 4 },
					};
				case "ask":
					if (!saved) throw new Error("Ask ran before save.");
					return {
						answer: "The public webs-plugins repository documents the companion.",
						citations: [{ url: saved.url, webId: saved.id }],
					};
				case "watch":
				return { monitors: [] };
				case "run":
					return { runId: "run_fixture", status: "completed" };
			}
		},
	};
}
