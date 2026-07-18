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
