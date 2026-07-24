import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createWebsTransport } from "../extensions/webs.ts";
import {
	createDeterministicWebsTransport,
	runWebsBattery,
	type WebsBatteryCaseResult,
} from "./battery.ts";

type BatteryMode = "deterministic" | "requires-token";

const HELP = process.argv.includes("--help") || process.argv.includes("-h");

if (HELP) {
	console.log(`Usage: pnpm battery [-- --mode deterministic|requires-token] [--out PATH]

Runs the agent-facing Webs MCP journey battery and writes canonical ProofRun JSON.

Modes:
  deterministic   in-memory MCP contract fixture; no Webs token is required
  requires-token  live Webs MCP transport; missing credentials fail loudly

Options:
  --out PATH      ProofRun output path (one-case battery only)
  --help          show this help text
`);
	process.exit(0);
}

const mode = readMode(process.argv.slice(2));
const out = readOption(process.argv.slice(2), "--out");
const transport =
	mode === "deterministic"
		? createDeterministicWebsTransport()
		: createWebsTransport();

try {
	const results = await runWebsBattery({
		transport,
		runIdPrefix: `webs-mcp-${mode}`,
		transportKind:
			mode === "deterministic" ? "deterministic-mcp-fixture" : "live-mcp",
	});
	const paths = writeProofRuns(results, out, mode);
	let failed = false;
	for (const [index, result] of results.entries()) {
		const path = paths[index];
		if (result.pass) {
			console.log(
				`[battery:${mode}] PASS ${result.caseId} score=${result.score.score.toFixed(2)} proof=${path}`,
			);
			continue;
		}
		failed = true;
		console.error(
			`[battery:${mode}] FAIL ${result.caseId} score=${result.score.score.toFixed(2)} proof=${path}`,
		);
		for (const blocker of result.score.blockers) {
			console.error(`[battery:${mode}] blocker: ${blocker}`);
		}
	}
	if (failed) process.exitCode = 1;
} catch (error) {
	console.error(
		`[battery:${mode}] configuration failure: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	process.exitCode = 1;
}

function readMode(argv: string[]): BatteryMode {
	const value = readOption(argv, "--mode") ?? "deterministic";
	if (value === "deterministic" || value === "requires-token") return value;
	throw new Error(
		`Unknown battery mode "${value}". Expected deterministic or requires-token.`,
	);
}

function readOption(argv: string[], name: string): string | undefined {
	const index = argv.indexOf(name);
	if (index === -1) return undefined;
	const value = argv[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value.`);
	}
	return value;
}

function writeProofRuns(
	results: readonly WebsBatteryCaseResult[],
	requestedOut: string | undefined,
	mode: BatteryMode,
): string[] {
	if (requestedOut && results.length !== 1) {
		throw new Error("--out is only valid when the battery selects one case.");
	}
	return results.map((result) => {
		const path = requestedOut
			? resolve(requestedOut)
			: resolve(
					join(
						".artifacts",
						"evals",
						`${mode}-${result.caseId}.proof.json`,
					),
				);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(result.proof, null, 2)}\n`);
		return path;
	});
}
