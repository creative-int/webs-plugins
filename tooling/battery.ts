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
import {
	readAnswerability,
	readAskEscalation,
	type WebsToolArguments,
	type WebsToolName,
	type WebsTransport,
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
	kind?: "journey";
	id: string;
	title: string;
	sourceUrl: string;
	task: string;
	why: string;
	query: string;
	question: string;
	idempotencyKey: string;
}

/**
 * Honest-abstention case: saved memory sits near the question but does not
 * answer it. Webs must abstain (`answerability.status: "unsupported"`, empty
 * citations, a `fresh_then_saved` escalation) instead of synthesizing.
 */
export interface WebsAbstentionCase {
	kind: "abstention";
	id: string;
	title: string;
	/** Near-topic source saved first, so memory is adjacent but insufficient. */
	sourceUrl: string;
	task: string;
	why: string;
	question: string;
	idempotencyKey: string;
	/**
	 * Current public facts are in scope: the right move is exactly one
	 * `fresh_then_saved` escalation. Otherwise the right move is to report that
	 * memory doesn't hold it, with no further ask.
	 */
	freshFactsInScope: boolean;
}

export type WebsBatterySuiteCase = WebsBatteryCase | WebsAbstentionCase;

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

export const DEFAULT_WEBS_ABSTENTION_CASES = [
	{
		kind: "abstention",
		id: "abstain-near-topic-unsupported",
		title:
			"Webs abstains when saved memory is near the topic but does not answer the question",
		sourceUrl: "https://github.com/creative-int/webs-plugins",
		task: "Verify Webs abstains honestly over near-topic saved memory",
		why: "Adjacent memory must not become a confident cited answer",
		question:
			"Which reviewer approved shipping four skills in the Webs agent companion, and on what date?",
		idempotencyKey: "webs-plugins-abstain-near-topic-v1",
		freshFactsInScope: false,
	},
	{
		kind: "abstention",
		id: "abstain-current-public-facts",
		title:
			"Webs abstains on current public facts and the agent escalates once to fresh_then_saved",
		sourceUrl: "https://github.com/creative-int/webs-plugins",
		task: "Verify the escalate-once rule for current public facts",
		why: "Saved memory is not proof of a current price; fresh evidence is one escalation away",
		question: "What does a Webs subscription cost per month today?",
		idempotencyKey: "webs-plugins-abstain-current-facts-v1",
		freshFactsInScope: true,
	},
] as const satisfies readonly WebsAbstentionCase[];

export const WEBS_BATTERY_SUITES = {
	journey: DEFAULT_WEBS_BATTERY_CASES,
	abstention: DEFAULT_WEBS_ABSTENTION_CASES,
	all: [...DEFAULT_WEBS_BATTERY_CASES, ...DEFAULT_WEBS_ABSTENTION_CASES],
} as const satisfies Record<string, readonly WebsBatterySuiteCase[]>;

export type WebsBatterySuite = keyof typeof WEBS_BATTERY_SUITES;

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

type BatteryRun = JourneyRunResult<
	BatteryStep,
	BatteryObservation,
	BatteryState
>;

export interface WebsBatteryCaseResult {
	caseId: string;
	gate: BatteryRun["gate"];
	pass: boolean;
	proof: ProofRun;
	score: ProofScoreResult;
	trace: BatteryRun["trace"];
}

export interface RunWebsBatteryOptions {
	cases?: readonly WebsBatterySuiteCase[];
	runIdPrefix?: string;
	transport: WebsTransport;
	transportKind?: "custom-webs-transport" | "deterministic-mcp-fixture" | "live-mcp";
}

type TransportKind = NonNullable<RunWebsBatteryOptions["transportKind"]>;

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
		const runIdPrefix = options.runIdPrefix ?? "webs-mcp-battery";
		const transportKind = options.transportKind ?? "custom-webs-transport";
		const run = isAbstentionCase(batteryCase)
			? await runAbstentionCase(
					batteryCase,
					options.transport,
					runIdPrefix,
					transportKind,
				)
			: await runBatteryCase(
					batteryCase,
					options.transport,
					runIdPrefix,
					transportKind,
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

export function isAbstentionCase(
	batteryCase: WebsBatterySuiteCase,
): batteryCase is WebsAbstentionCase {
	return batteryCase.kind === "abstention";
}

async function runBatteryCase(
	batteryCase: WebsBatteryCase,
	transport: WebsTransport,
	runIdPrefix: string,
	transportKind: TransportKind,
): Promise<BatteryRun> {
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

/**
 * Honest-abstention journey: readiness, save near-topic memory, ask
 * `saved_only`, then either stop (report that memory doesn't hold it) or take
 * Webs' one-tap `fresh_then_saved` escalation exactly once. It never retries
 * the saved ask.
 */
async function runAbstentionCase(
	batteryCase: WebsAbstentionCase,
	transport: WebsTransport,
	runIdPrefix: string,
	transportKind: TransportKind,
): Promise<BatteryRun> {
	const requiredAssertions = [
		"battery.surface.exact-seven",
		"battery.journey.tool-order",
		"battery.save.agent-intent",
		"battery.abstain.answerability-unsupported",
		"battery.abstain.no-citations",
		"battery.abstain.no-synthesis",
		"battery.abstain.escalation-offered",
		batteryCase.freshFactsInScope
			? "battery.abstain.escalate-once"
			: "battery.abstain.report-missing",
	];
	const steps: BatteryStep[] = [
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
	];
	if (batteryCase.freshFactsInScope) {
		// Arguments come from the saved ask's escalation at run time.
		steps.push({ id: "escalate", operation: "ask", input: {} });
	}

	const scenario: JourneyScenario<
		BatteryStep,
		undefined,
		undefined,
		BatteryObservation,
		BatteryState
	> = {
		id: batteryCase.id,
		title: batteryCase.title,
		tags: ["mcp", "agent-facing", "proof-run", "fail-closed", "abstention"],
		steps,
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
				id: "honest-abstention-contract",
				scope: "journey",
				score: ({ finalState }) =>
					scoreAbstentionContract(finalState, batteryCase),
			},
		],
		proof: {
			repo: "creative-int/webs-plugins",
			packageVersions: { "@creative-int/evals": "1.8.0" },
			userGoal:
				"Prove Webs abstains honestly when saved memory does not hold the answer, and the agent escalates at most once.",
			agentRoute: "source-ingest",
			allowedTools: [...WEBS_BATTERY_TOOL_SURFACE],
			proofClass: "deterministic-proof",
			metadata: {
				batteryCaseId: batteryCase.id,
				batteryCaseKind: "abstention",
				freshFactsInScope: batteryCase.freshFactsInScope,
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
			const args =
				step.id === "escalate"
					? escalationArgs(context)
					: argsForStep(step, context.savedWebId);
			const result = await transport.callTool(step.operation, args, signal);
			context.calls.push({ args, result, tool: step.operation });
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

/** The one-tap escalation, passed exactly as Webs returned it. */
function escalationArgs(context: BatteryContext): WebsToolArguments {
	const savedAsk = context.calls.find((call) => call.tool === "ask");
	const escalation = readAskEscalation(savedAsk?.result);
	if (!escalation) {
		throw new Error(
			"Webs offered no fresh_then_saved escalation after the saved ask; there is nothing to escalate once.",
		);
	}
	return structuredClone(escalation.action.params) as WebsToolArguments;
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

function scoreAbstentionContract(
	state: BatteryState | undefined,
	batteryCase: WebsAbstentionCase,
): ProofAssertion[] {
	const calls = state?.calls ?? [];
	const readiness = calls.find((call) => call.tool === "readiness");
	const save = calls.find((call) => call.tool === "save");
	const asks = calls.filter((call) => call.tool === "ask");
	const savedAsk = asks[0];
	const escalation = readAskEscalation(savedAsk?.result);
	const expectedOrder: WebsToolName[] = batteryCase.freshFactsInScope
		? ["readiness", "save", "ask", "ask"]
		: ["readiness", "save", "ask"];

	const finalAssertion = batteryCase.freshFactsInScope
		? assertion(
				"battery.abstain.escalate-once",
				asks.length === 2 &&
					asks[1]?.args.mode === "fresh_then_saved" &&
					asks[1].args.question === batteryCase.question &&
					isHonestAskResult(asks[1].result),
				"Current public facts are in scope, so the agent takes the fresh_then_saved escalation exactly once and accepts its honest result.",
			)
		: assertion(
				"battery.abstain.report-missing",
				asks.length === 1,
				"Current public facts are not in scope, so the agent reports that memory doesn't hold it and does not ask again.",
			);

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
				expectedOrder,
			),
			`The abstention journey executes ${expectedOrder.join(", ")}.`,
		),
		assertion(
			"battery.save.agent-intent",
			save?.args.task === batteryCase.task &&
				save.args.why === batteryCase.why &&
				save.args.idempotencyKey === batteryCase.idempotencyKey,
			"Save carries task, why, and idempotencyKey.",
		),
		assertion(
			"battery.abstain.answerability-unsupported",
			savedAsk?.args.mode === "saved_only" &&
				readAnswerability(savedAsk.result)?.status === "unsupported",
			"The saved ask reports answerability.status 'unsupported'; an absent field means the Webs answerability gate is off.",
		),
		assertion(
			"battery.abstain.no-citations",
			citationList(savedAsk?.result)?.length === 0,
			"The abstaining ask returns citations: [].",
		),
		assertion(
			"battery.abstain.no-synthesis",
			isAbstainingAnswer(savedAsk?.result),
			"The abstaining ask states the gap in plain text, with no cited synthesis.",
		),
		assertion(
			"battery.abstain.escalation-offered",
			escalation?.action.params.question === batteryCase.question,
			"The abstaining ask offers a one-tap fresh_then_saved escalation for the same question.",
		),
		finalAssertion,
	];
}

function citationList(value: unknown): unknown[] | undefined {
	if (!isRecord(value) || !Array.isArray(value.citations)) return undefined;
	return value.citations;
}

function isAbstainingAnswer(value: unknown): boolean {
	if (!isRecord(value) || typeof value.answer !== "string") return false;
	const answer = value.answer.trim();
	return answer.length > 0 && !/\[\d+\]/.test(answer);
}

/** An unsupported verdict never carries citations; any other verdict may. */
function isHonestAskResult(value: unknown): boolean {
	const citations = citationList(value);
	if (!isRecord(value) || typeof value.answer !== "string" || !citations) {
		return false;
	}
	return readAnswerability(value)?.status === "unsupported"
		? citations.length === 0
		: true;
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
	const answerability =
		step.operation === "ask" ? readAnswerability(result) : undefined;
	return {
		id: `${caseId}-${step.id}`,
		kind,
		label: `Webs MCP ${step.operation} normalized result`,
		metadata: {
			tool: step.operation,
			citationCount,
			containsSavedWebId: Boolean(extractSavedWebId(result)),
			...(answerability ? { answerability: answerability.status } : {}),
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

/** Verdict label the fixture reports, matching the Webs answerability seam. */
export const FIXTURE_ANSWERABILITY_SEAM = "jev-1.13.0";

const FIXTURE_FRESH_URL = "https://fresh-evidence.fixture.invalid/current-facts";

export interface DeterministicWebsTransportOptions {
	/**
	 * Mirror Webs' answerability gate. `on` (default) returns the optional
	 * `answerability` field and abstains on unsupported questions. `off`
	 * reproduces the ungated path, where near-topic memory becomes a cited
	 * answer, so abstention cases fail closed against it.
	 */
	answerability?: "on" | "off";
	/** Questions saved memory cannot answer. Defaults to the abstention cases. */
	unsupportedQuestions?: readonly string[];
}

export function createDeterministicWebsTransport(
	options: DeterministicWebsTransportOptions = {},
): WebsTransport {
	const gateOn = (options.answerability ?? "on") === "on";
	const unsupportedQuestions = new Set(
		(
			options.unsupportedQuestions ??
			DEFAULT_WEBS_ABSTENTION_CASES.map((batteryCase) => batteryCase.question)
		).map((question) => question.trim()),
	);
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
				case "ask": {
					if (!saved) throw new Error("Ask ran before save.");
					const question =
						typeof args.question === "string" ? args.question.trim() : "";
					const mode = args.mode;
					if (!unsupportedQuestions.has(question)) {
						return {
							answer:
								"The public webs-plugins repository documents the companion.",
							citations: [{ url: saved.url, webId: saved.id }],
							...(gateOn
								? {
										answerability: {
											status: "supported",
											confidence: 0.93,
											seam: FIXTURE_ANSWERABILITY_SEAM,
										},
									}
								: {}),
						};
					}
					const escalation = {
						action: {
							tool: "ask",
							params: {
								mode: "fresh_then_saved",
								question,
								...(isRecord(args.scope) ? { scope: args.scope } : {}),
							},
						},
					};
					if (mode === "fresh_then_saved") {
						return {
							answer: "Fresh public evidence answers the question [1].",
							citations: [
								{ url: FIXTURE_FRESH_URL, title: "Fresh fixture evidence" },
							],
							mode,
							usedFreshUrls: [FIXTURE_FRESH_URL],
							...(gateOn
								? {
										answerability: {
											status: "supported",
											confidence: 0.9,
											seam: FIXTURE_ANSWERABILITY_SEAM,
										},
									}
								: {}),
						};
					}
					if (!gateOn) {
						// The ungated path: adjacent memory becomes a cited answer.
						return {
							answer:
								"The public webs-plugins repository covers the Webs agent companion [1].",
							citations: [{ url: saved.url, webId: saved.id }],
							confidence: 0.62,
							mode,
							escalation: {
								reason: "weak_saved_result",
								threshold: 0.8,
								confidence: 0.62,
								...escalation,
							},
						};
					}
					return {
						answer:
							"Saved Webs memory does not directly support an answer to that question.",
						citations: [],
						confidence: 0,
						mode,
						summary: "Saved memory did not contain enough evidence.",
						answerability: {
							status: "unsupported",
							confidence: 0.9,
							seam: FIXTURE_ANSWERABILITY_SEAM,
						},
						escalation: {
							reason: "answerability_unsupported",
							confidence: 0,
							...escalation,
						},
					};
				}
				case "watch":
					return { monitors: [] };
				case "run":
					return { runId: "run_fixture", status: "completed" };
			}
		},
	};
}
