import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type WebsToolName =
	| "readiness"
	| "save"
	| "recall"
	| "context"
	| "ask"
	| "watch"
	| "run";

export type WebsToolArguments = Record<string, unknown>;

export type WebsAskMode = "saved_only" | "saved_memory" | "fresh_then_saved";

/**
 * Webs' answerability verdict on an `ask`. Optional: absent when the Webs
 * answerability gate is off for the call.
 *
 * - `supported`: saved evidence directly supports the answer.
 * - `unsupported`: honest abstention. Nothing was synthesized, `citations` is
 *   empty, and the result offers a `fresh_then_saved` escalation.
 * - `skipped`: the gate did not run, and the answer took the ungated path.
 */
export type WebsAnswerabilityStatus = "supported" | "unsupported" | "skipped";

export interface WebsAnswerability {
	confidence?: number;
	/** Judge and version that produced the verdict, for example `jev-1.13.0`. */
	seam: string;
	status: WebsAnswerabilityStatus;
}

/** One-tap follow-up Webs offers when saved memory is weak or unsupported. */
export interface WebsAskEscalation {
	action: {
		params: {
			mode: "fresh_then_saved";
			question: string;
			scope?: unknown;
		} & Record<string, unknown>;
		tool: "ask";
	};
	confidence?: number;
	reason?: string;
	threshold?: number;
}

/**
 * The `ask` result fields agents act on. Webs owns the full contract; this
 * mirror names the fields the plugin reads and keeps every other field.
 */
export interface WebsAskResult extends Record<string, unknown> {
	answer: string;
	answerability?: WebsAnswerability;
	citations: unknown[];
	confidence?: number;
	escalation?: WebsAskEscalation;
	mode?: WebsAskMode;
	summary?: string;
}

export interface WebsTransport {
	callTool(
		name: WebsToolName,
		args: WebsToolArguments,
		signal?: AbortSignal,
	): Promise<unknown>;
}

export type WebsPiExtensionFactory = (
	transport?: WebsTransport,
) => (pi: ExtensionAPI) => void;
