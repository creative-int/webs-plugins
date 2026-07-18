import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { websToolContracts } from "./schemas.ts";
import { createWebsTransport, sanitizeValue, WebsExtensionError } from "./transport.ts";
import type {
	WebsPiExtensionFactory,
	WebsToolArguments,
	WebsTransport,
} from "./types.ts";

export type {
	WebsPiExtensionFactory,
	WebsToolArguments,
	WebsToolName,
	WebsTransport,
} from "./types.ts";
export { createWebsTransport, WebsExtensionError } from "./transport.ts";
export { websToolContracts } from "./schemas.ts";

interface WebsResultDetails {
	error?: {
		code?: number;
		kind: string;
		profile?: string;
		status?: number;
	};
	ok: boolean;
	result?: unknown;
	tool: string;
}

const createWebsPiExtension: WebsPiExtensionFactory = (
	transport: WebsTransport = createWebsTransport(),
) => {
	return (pi: ExtensionAPI) => {
		for (const contract of websToolContracts) {
			pi.registerTool<typeof contract.parameters, WebsResultDetails>({
				name: contract.name,
				label: contract.label,
				description: contract.description,
				promptSnippet: `Call Webs ${contract.name} against the configured remote MCP endpoint`,
				parameters: contract.parameters,
				async execute(_toolCallId, params, signal) {
					try {
						const result = sanitizeValue(
							await transport.callTool(
								contract.name,
								params as WebsToolArguments,
								signal,
							),
						);
						return {
							content: [{ type: "text" as const, text: readableResult(result) }],
							details: {
								ok: true,
								result,
								tool: contract.name,
							} satisfies WebsResultDetails,
						};
					} catch (error) {
						const normalized = normalizeError(error);
						return {
							content: [{ type: "text" as const, text: normalized.message }],
							details: {
								error: normalized.details,
								ok: false,
								tool: contract.name,
							} satisfies WebsResultDetails,
							isError: true,
						};
					}
				},
			});
		}
	};
};

function readableResult(result: unknown): string {
	if (typeof result === "string") return result;
	if (result === undefined) return "Webs tool call completed.";
	try {
		return JSON.stringify(result, null, 2);
	} catch {
		return "Webs tool call completed with structured details.";
	}
}

function normalizeError(error: unknown): {
	details: NonNullable<WebsResultDetails["error"]>;
	message: string;
} {
	if (error instanceof WebsExtensionError) {
		return {
			message: error.message,
			details: {
				kind: error.kind,
				...(error.code === undefined ? {} : { code: error.code }),
				...(error.profile === undefined ? {} : { profile: error.profile }),
				...(error.status === undefined ? {} : { status: error.status }),
			},
		};
	}
	return {
		message: "Webs tool call failed.",
		details: { kind: "transport" },
	};
}

export default createWebsPiExtension;
