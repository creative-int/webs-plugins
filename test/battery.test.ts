import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import {
	parseProofRun,
	PROOF_ARTIFACT_VERSION,
	scoreProofRun,
} from "@creative-int/evals/proof";
import { createWebsTransport, type WebsTransport } from "../extensions/webs.ts";
import {
	createDeterministicWebsTransport,
	runWebsBattery,
	WEBS_BATTERY_JOURNEY_ORDER,
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
