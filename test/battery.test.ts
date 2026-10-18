import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import {
	parseProofRun,
	PROOF_ARTIFACT_VERSION,
	scoreProofRun,
	type ProofRun,
} from "@creative-int/evals/proof";
import {
	createWebsTransport,
	type WebsToolArguments,
	type WebsTransport,
} from "../extensions/webs.ts";
import {
	createDeterministicWebsTransport,
	DEFAULT_WEBS_ABSTENTION_CASES,
	runWebsBattery,
	WEBS_BATTERY_JOURNEY_ORDER,
	WEBS_BATTERY_SUITES,
} from "../tooling/battery.ts";

test("emits a passing canonical ProofRun for the deterministic MCP journey", async () => {
	const [result] = await runWebsBattery({
		transport: createDeterministicWebsTransport(),
		runIdPrefix: "test-deterministic",
		transportKind: "deterministic-mcp-fixture",
	});

	assert.ok(result);
	const proof = parseProofRun(JSON.parse(JSON.stringify(result.proof)));
	assert.deepEqual(proof, result.proof);
	assert.equal(result.pass, true);
	assert.equal(result.gate.pass, true);
	assert.equal(result.score.score, 1);
	assert.deepEqual(result.score.blockers, []);
	// Keep the released v1 baseline compatible with the intentional v2 upgrade.
	assert.ok(
		["creative-int.proof-run.v1", "creative-int.proof-run.v2"].includes(
			PROOF_ARTIFACT_VERSION,
		),
	);
	assert.equal(proof.artifactVersion, PROOF_ARTIFACT_VERSION);
	assert.equal(proof.proofClass, "deterministic-proof");
	assert.equal(
		proof.intent.userGoal,
		"Prove the public agent-facing Webs MCP memory journey without skip-into-green.",
	);
	assert.equal(result.proof.packageVersions["@creative-int/evals"], "1.8.0");
	assert.equal(result.proof.intent.agentRoute, "source-ingest");
	assert.equal(result.proof.evidence.artifacts.length, 5);
	assert.equal(
		result.proof.evidence.artifacts.filter(
			(artifact) => artifact.kind === "citation",
		).length,
		3,
	);
	assert.equal(
		result.proof.metadata?.transport,
		"deterministic-mcp-fixture",
	);
	assert.deepEqual(
		result.trace.observations.map((observation) => observation.stepId),
		WEBS_BATTERY_JOURNEY_ORDER,
	);
});

test("rejects malformed serialized battery proof through the canonical parser", async () => {
	const [result] = await runWebsBattery({
		transport: createDeterministicWebsTransport(),
	});
	assert.ok(result);
	const proof = result.proof;
	const malformed = [
		[
			{ ...proof, artifactVersion: "creative-int.proof-run.v999" },
			/artifactVersion/,
		],
		[{ ...proof, intent: undefined }, /intent/],
		[
			{ ...proof, intent: { ...proof.intent, userGoal: undefined } },
			/userGoal/,
		],
		[
			{ ...proof, intent: { ...proof.intent, agentRoute: "unknown" } },
			/agentRoute/,
		],
		[{ ...proof, evidence: { artifacts: [{ kind: "unknown" }] } }, /kind/],
	] as const;
	for (const [input, error] of malformed) {
		assert.throws(
			() => parseProofRun(JSON.parse(JSON.stringify(input))),
			error,
		);
	}
});

test("legacy v1 saved proof retains failed assertions and blockers when parsed", () => {
	const legacy = {
		artifactVersion: "creative-int.proof-run.v1",
		intent: {
			userGoal: "Verify a saved Webs MCP journey",
			agentRoute: "source-ingest",
		},
		eval: {
			assertions: [{ name: "MCP response", status: "fail" }],
			blockers: ["MCP response unavailable"],
		},
	};
	const proof = parseProofRun(JSON.parse(JSON.stringify(legacy)));
	assert.equal(proof.artifactVersion, PROOF_ARTIFACT_VERSION);
	assert.equal(proof.intent.userGoal, legacy.intent.userGoal);
	assert.equal(proof.intent.agentRoute, legacy.intent.agentRoute);
	assert.deepEqual(proof.eval.assertions, legacy.eval.assertions);
	assert.deepEqual(proof.eval.blockers, legacy.eval.blockers);
	const score = scoreProofRun(proof);
	assert.ok(score.score < 1);
	assert.ok(score.blockers.includes("MCP response unavailable"));
});

test("rejects zero-case battery runs instead of skipping into green", async () => {
	await assert.rejects(
		runWebsBattery({
			cases: [],
			transport: createDeterministicWebsTransport(),
		}),
		/at least one case; zero-case runs fail closed/,
	);
});

test("turns transport failures into a failing ProofRun", async () => {
	const transport: WebsTransport = {
		async callTool() {
			throw new Error("fixture transport unavailable");
		},
	};
	const [result] = await runWebsBattery({ transport });

	assert.ok(result);
	assert.equal(result.pass, false);
	assert.equal(result.gate.pass, false);
	assert.ok(result.score.score < 1);
	assert.ok(result.score.blockers.length > 0);
	assert.equal(result.trace.status, "failed");
});

test("missing live credentials fail the first readiness step", async () => {
	const transport = createWebsTransport({
		configPath: join(
			"/tmp",
			`webs-battery-missing-${process.pid}-${Date.now()}.json`,
		),
		env: {},
	});
	const [result] = await runWebsBattery({ transport });

	assert.ok(result);
	assert.equal(result.pass, false);
	assert.equal(result.trace.observations[0]?.stepId, "readiness");
	assert.equal(result.trace.observations[0]?.status, "failed");
	assert.match(
		result.trace.observations[0]?.error?.message ?? "",
		/No Webs MCP token was found/,
	);
});

test("abstention cases pass against a mocked unsupported ask", async () => {
	const results = await runWebsBattery({
		cases: DEFAULT_WEBS_ABSTENTION_CASES,
		transport: createDeterministicWebsTransport(),
		runIdPrefix: "test-abstention",
		transportKind: "deterministic-mcp-fixture",
	});

	assert.deepEqual(
		results.map((result) => result.caseId),
		["abstain-near-topic-unsupported", "abstain-current-public-facts"],
	);
	for (const result of results) {
		assert.equal(result.pass, true, result.caseId);
		assert.equal(result.gate.pass, true);
		assert.equal(result.score.score, 1);
		assert.deepEqual(result.score.blockers, []);
		const proof = parseProofRun(JSON.parse(JSON.stringify(result.proof)));
		assert.deepEqual(proof, result.proof);
		assert.equal(proof.metadata?.batteryCaseKind, "abstention");
		const savedAsk = proof.evidence.artifacts.find(
			(artifact) => artifact.id === `${result.caseId}-ask`,
		);
		assert.equal(savedAsk?.kind, "test-result");
		assert.equal(savedAsk?.metadata?.citationCount, 0);
		assert.equal(savedAsk?.metadata?.answerability, "unsupported");
	}

	const [nearTopic, currentFacts] = results;
	assert.deepEqual(
		nearTopic?.trace.observations.map((observation) => observation.stepId),
		["readiness", "save", "ask"],
	);
	assert.deepEqual(
		currentFacts?.trace.observations.map((observation) => observation.stepId),
		["readiness", "save", "ask", "escalate"],
	);
});

test("abstention cases escalate once with the one-tap params and never retry", async () => {
	const asks: WebsToolArguments[] = [];
	const fixture = createDeterministicWebsTransport();
	const transport: WebsTransport = {
		async callTool(name, args, signal) {
			if (name === "ask") asks.push(structuredClone(args));
			return fixture.callTool(name, args, signal);
		},
	};
	const results = await runWebsBattery({
		cases: DEFAULT_WEBS_ABSTENTION_CASES,
		transport,
	});

	assert.ok(results.every((result) => result.pass));
	const nearTopic = DEFAULT_WEBS_ABSTENTION_CASES[0];
	const currentFacts = DEFAULT_WEBS_ABSTENTION_CASES[1];
	assert.deepEqual(
		asks.map((args) => [args.question, args.mode]),
		[
			[nearTopic.question, "saved_only"],
			[currentFacts.question, "saved_only"],
			[currentFacts.question, "fresh_then_saved"],
		],
	);
	assert.deepEqual(asks[2], {
		mode: "fresh_then_saved",
		question: currentFacts.question,
		scope: { webIds: ["web_fixture_agent_memory"] },
	});
});

test("journey and abstention suites pass together without regressing the journey", async () => {
	const results = await runWebsBattery({
		cases: WEBS_BATTERY_SUITES.all,
		transport: createDeterministicWebsTransport(),
	});

	assert.equal(results.length, 3);
	assert.ok(results.every((result) => result.pass));
	const [journey] = results;
	assert.equal(journey?.caseId, "agent-memory-roundtrip");
	assert.equal(journey?.proof.evidence.artifacts.length, 5);
	assert.equal(
		journey?.proof.evidence.artifacts.filter(
			(artifact) => artifact.kind === "citation",
		).length,
		3,
	);
});

test("the journey still passes when Webs omits answerability", async () => {
	const [journey] = await runWebsBattery({
		transport: createDeterministicWebsTransport({ answerability: "off" }),
	});

	assert.ok(journey);
	assert.equal(journey.pass, true);
});

test("an ungated Webs that synthesizes over near-topic memory fails the abstention battery", async () => {
	const results = await runWebsBattery({
		cases: DEFAULT_WEBS_ABSTENTION_CASES,
		transport: createDeterministicWebsTransport({ answerability: "off" }),
	});

	for (const result of results) {
		assert.equal(result.pass, false, result.caseId);
		assert.equal(result.gate.pass, false);
		assert.deepEqual(failedAssertions(result.proof), [
			"battery.abstain.answerability-unsupported",
			"battery.abstain.no-citations",
			"battery.abstain.no-synthesis",
		]);
	}
});

test("an unsupported verdict that still carries citations fails closed", async () => {
	const fixture = createDeterministicWebsTransport();
	const transport: WebsTransport = {
		async callTool(name, args, signal) {
			const result = await fixture.callTool(name, args, signal);
			if (name !== "ask" || args.mode !== "saved_only") return result;
			return {
				...(result as Record<string, unknown>),
				answer: "Near-topic memory suggests an answer [1].",
				citations: [{ url: "https://github.com/creative-int/webs-plugins" }],
			};
		},
	};
	const [nearTopic] = await runWebsBattery({
		cases: [DEFAULT_WEBS_ABSTENTION_CASES[0]],
		transport,
	});

	assert.ok(nearTopic);
	assert.equal(nearTopic.pass, false);
	assert.deepEqual(failedAssertions(nearTopic.proof), [
		"battery.abstain.no-citations",
		"battery.abstain.no-synthesis",
	]);
});

test("a missing escalation fails closed instead of retrying the saved ask", async () => {
	const asks: WebsToolArguments[] = [];
	const fixture = createDeterministicWebsTransport();
	const transport: WebsTransport = {
		async callTool(name, args, signal) {
			const result = await fixture.callTool(name, args, signal);
			if (name !== "ask") return result;
			asks.push(args);
			const { escalation: _escalation, ...rest } = result as Record<
				string,
				unknown
			>;
			return rest;
		},
	};
	const [nearTopic, currentFacts] = await runWebsBattery({
		cases: DEFAULT_WEBS_ABSTENTION_CASES,
		transport,
	});

	assert.ok(nearTopic && currentFacts);
	assert.deepEqual(failedAssertions(nearTopic.proof), [
		"battery.abstain.escalation-offered",
	]);
	assert.equal(currentFacts.pass, false);
	assert.equal(currentFacts.trace.status, "failed");
	assert.match(
		currentFacts.trace.observations.at(-1)?.error?.message ?? "",
		/no fresh_then_saved escalation/,
	);
	assert.deepEqual(
		asks.map((args) => args.mode),
		["saved_only", "saved_only"],
	);
});

function failedAssertions(proof: ProofRun): string[] {
	return proof.eval.assertions
		.filter((assertion) => assertion.status === "fail")
		.map((assertion) => assertion.name);
}
