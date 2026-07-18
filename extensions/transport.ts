import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import type {
	WebsToolArguments,
	WebsToolName,
	WebsTransport,
} from "./types.ts";

const DEFAULT_MCP_URL = "https://webs.creative-int.com/mcp";
const MAX_ERROR_BODY = 500;

type WebsErrorKind = "abort" | "auth" | "config" | "http" | "mcp" | "network";

interface WebsConfigFile {
	currentProfile?: string;
	profiles?: Record<string, WebsProfile>;
}

interface WebsProfile {
	baseUrl?: string;
	endpoint?: string;
	expiresAt?: string;
	token?: string;
}

interface ResolvedConnection {
	endpoint: string;
	profile: string;
	token: string;
}

interface JsonRpcResponse {
	error?: { code?: number; message?: string };
	jsonrpc?: string;
	result?: unknown;
}

export interface WebsTransportOptions {
	configPath?: string;
	env?: NodeJS.ProcessEnv;
	fetch?: typeof fetch;
	now?: () => number;
}

export class WebsExtensionError extends Error {
	readonly code?: number;
	readonly kind: WebsErrorKind;
	readonly profile?: string;
	readonly status?: number;

	constructor(
		kind: WebsErrorKind,
		message: string,
		options: { code?: number; profile?: string; status?: number } = {},
	) {
		super(message);
		this.name = "WebsExtensionError";
		this.kind = kind;
		this.code = options.code;
		this.profile = options.profile;
		this.status = options.status;
	}
}

export function createWebsTransport(
	options: WebsTransportOptions = {},
): WebsTransport {
	const env = options.env ?? process.env;
	const fetchImpl = options.fetch ?? fetch;
	const now = options.now ?? Date.now;
	let nextRpcId = 1;

	return {
		async callTool(
			name: WebsToolName,
			args: WebsToolArguments,
			signal?: AbortSignal,
		): Promise<unknown> {
			const connection = resolveConnection({
				configPath: options.configPath,
				env,
				now,
			});
			let response: Response;
			try {
				response = await fetchImpl(connection.endpoint, {
					method: "POST",
					headers: {
						accept: "application/json, text/event-stream",
						authorization: `Bearer ${connection.token}`,
						"content-type": "application/json",
						"mcp-protocol-version": "2025-06-18",
					},
					body: JSON.stringify({
						id: nextRpcId++,
						jsonrpc: "2.0",
						method: "tools/call",
						params: { arguments: args, name },
					}),
					signal,
				});
			} catch (error) {
				throw networkError(error, signal);
			}

			if (!response.ok) {
				const body = sanitizeErrorText(
					await readBoundedErrorBody(response),
					connection.token,
				);
				if (response.status === 401 || response.status === 403) {
					throw authError(
						connection.profile,
						`Webs MCP rejected the selected credentials (HTTP ${response.status}).`,
						response.status,
					);
				}
				const suffix = body ? ` Response: ${body}` : "";
				throw new WebsExtensionError(
					"http",
					`Webs MCP returned HTTP ${response.status}.${suffix}`,
					{ profile: connection.profile, status: response.status },
				);
			}

			let text: string;
			try {
				text = await response.text();
			} catch (error) {
				throw networkError(error, signal);
			}
			const rpc = parseRpcResponse(
				text,
				response.headers.get("content-type"),
				connection.token,
			);
			if (rpc.error) {
				const message = sanitizeErrorText(
					typeof rpc.error.message === "string"
						? rpc.error.message
						: "Webs MCP returned an unspecified JSON-RPC error.",
					connection.token,
				);
				if (looksLikeAuthFailure(message)) {
					throw authError(connection.profile, message);
				}
				throw new WebsExtensionError("mcp", `Webs MCP error: ${message}`, {
					code:
						typeof rpc.error.code === "number" ? rpc.error.code : undefined,
					profile: connection.profile,
				});
			}
			if (!("result" in rpc)) {
				throw new WebsExtensionError(
					"mcp",
					"Webs MCP returned a JSON-RPC response without a result.",
					{ profile: connection.profile },
				);
			}
			return sanitizeValue(unwrapToolResult(rpc.result), connection.token);
		},
	};
}

function resolveConnection(options: {
	configPath?: string;
	env: NodeJS.ProcessEnv;
	now: () => number;
}): ResolvedConnection {
	const configPath =
		options.configPath ??
		(options.env.WEBS_CONFIG
			? resolve(options.env.WEBS_CONFIG)
			: join(
					options.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
					"webs",
					"config.json",
				));
	const config = readConfig(configPath, options.env.WEBS_PROFILE);
	const profileName = firstNonEmpty(
		options.env.WEBS_PROFILE,
		config.currentProfile,
		"prod",
	) as string;
	const profile = selectedProfile(config, profileName, configPath);
	const envToken = firstNonEmpty(
		options.env.WEBS_MCP_TOKEN,
		options.env.WEBS_API_TOKEN,
		options.env.WEBS_TOKEN,
	);
	const token = envToken ?? firstNonEmpty(profile.token);

	if (!token) {
		throw authError(profileName, "No Webs MCP token was found.");
	}
	if (!envToken && profile.expiresAt) {
		const expiresAt = Date.parse(profile.expiresAt);
		if (!Number.isFinite(expiresAt)) {
			throw configError(configPath, profileName);
		}
		if (expiresAt <= options.now()) {
			throw authError(profileName, "The selected Webs credentials have expired.");
		}
	}

	const endpoint = normalizeEndpoint(
		firstNonEmpty(options.env.WEBS_MCP_URL, profile.endpoint),
		firstNonEmpty(profile.baseUrl),
		configPath,
		profileName,
	);
	return { endpoint, profile: profileName, token };
}

function readConfig(path: string, requestedProfile?: string): WebsConfigFile {
	if (!existsSync(path)) return { profiles: {} };
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
	} catch {
		throw configError(path, firstNonEmpty(requestedProfile, "prod") as string);
	}
	if (!isRecord(parsed)) {
		throw configError(path, firstNonEmpty(requestedProfile, "prod") as string);
	}
	if (
		parsed.currentProfile !== undefined &&
		typeof parsed.currentProfile !== "string"
	) {
		throw configError(path, firstNonEmpty(requestedProfile, "prod") as string);
	}
	if (parsed.profiles !== undefined && !isRecord(parsed.profiles)) {
		throw configError(
			path,
			firstNonEmpty(requestedProfile, parsed.currentProfile, "prod") as string,
		);
	}
	return parsed as WebsConfigFile;
}

function selectedProfile(
	config: WebsConfigFile,
	name: string,
	configPath: string,
): WebsProfile {
	const value = config.profiles?.[name];
	if (value === undefined) return {};
	if (!isRecord(value)) throw configError(configPath, name);
	for (const key of ["baseUrl", "endpoint", "expiresAt", "token"] as const) {
		if (value[key] !== undefined && typeof value[key] !== "string") {
			throw configError(configPath, name);
		}
	}
	return value as WebsProfile;
}

function normalizeEndpoint(
	endpointValue: string | undefined,
	baseUrlValue: string | undefined,
	configPath: string,
	profile: string,
): string {
	const candidate = endpointValue ?? baseUrlValue ?? DEFAULT_MCP_URL;
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		throw configError(configPath, profile);
	}
	if (
		!(["http:", "https:"] as string[]).includes(url.protocol) ||
		url.username ||
		url.password
	) {
		throw configError(configPath, profile);
	}
	url.hash = "";
	if (endpointValue || url.pathname.replace(/\/+$/, "").endsWith("/mcp")) {
		return url.toString().replace(/\/+$/, "");
	}
	url.pathname = `${url.pathname.replace(/\/+$/, "")}/mcp`;
	return url.toString().replace(/\/+$/, "");
}

function parseRpcResponse(
	text: string,
	contentType: string | null,
	token: string,
): JsonRpcResponse {
	if (contentType?.includes("text/event-stream")) {
		const payloads = text
			.split(/\r?\n\r?\n/)
			.map((event) =>
				event
					.split(/\r?\n/)
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice("data:".length).trimStart())
					.join("\n")
					.trim(),
			)
			.filter((payload) => payload && payload !== "[DONE]");
		const payload = payloads.at(-1);
		if (!payload) {
			throw new WebsExtensionError(
				"mcp",
				"Webs MCP stream ended without a JSON-RPC payload.",
			);
		}
		return parseJsonRpc(payload, token);
	}
	return parseJsonRpc(text, token);
}

function parseJsonRpc(text: string, token: string): JsonRpcResponse {
	try {
		const parsed = JSON.parse(text) as unknown;
		if (!isRecord(parsed) || Array.isArray(parsed)) throw new Error("shape");
		return parsed as JsonRpcResponse;
	} catch {
		throw new WebsExtensionError(
			"mcp",
			`Webs MCP returned invalid JSON${text.trim() ? `: ${sanitizeErrorText(text, token)}` : "."}`,
		);
	}
}

function unwrapToolResult(result: unknown): unknown {
	if (!isRecord(result)) return result;
	if ("structuredContent" in result) return result.structuredContent;
	if (!Array.isArray(result.content)) return result;
	const text = result.content
		.filter(
			(part): part is { text: string; type: "text" } =>
				isRecord(part) && part.type === "text" && typeof part.text === "string",
		)
		.map((part) => part.text)
		.join("\n");
	if (!text) return result;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

async function readBoundedErrorBody(response: Response): Promise<string> {
	if (!response.body) return (await response.text()).slice(0, MAX_ERROR_BODY);
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let output = "";
	while (output.length < MAX_ERROR_BODY) {
		const { done, value } = await reader.read();
		if (done) break;
		output += decoder.decode(value, { stream: true });
	}
	void reader.cancel().catch(() => undefined);
	return output.slice(0, MAX_ERROR_BODY);
}

function networkError(error: unknown, signal?: AbortSignal): WebsExtensionError {
	if (
		signal?.aborted ||
		(error instanceof Error && error.name === "AbortError")
	) {
		return new WebsExtensionError("abort", "Webs MCP request was cancelled.");
	}
	return new WebsExtensionError(
		"network",
		"Unable to reach the Webs MCP endpoint.",
	);
}

function authError(
	profile: string,
	prefix: string,
	status?: number,
): WebsExtensionError {
	const safeProfile = profile.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "prod";
	return new WebsExtensionError(
		"auth",
		`${prefix} Run: webs login --profile ${safeProfile}`,
		{ profile: safeProfile, status },
	);
}

function configError(_path: string, profile: string): WebsExtensionError {
	const safeProfile = profile.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "prod";
	return new WebsExtensionError(
		"config",
		`Unable to read a valid Webs CLI config. Repair it or run: webs login --profile ${safeProfile}`,
		{ profile: safeProfile },
	);
}

function redactText(value: string, token?: string): string {
	let text = value;
	if (token) text = text.split(token).join("[redacted]");
	return text
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
		.replace(
			/((?:access[_-]?token|authorization|token)\s*[=:]\s*["']?)[^\s,"'}]+/gi,
			"$1[redacted]",
		);
}

function sanitizeErrorText(value: string, token?: string): string {
	return redactText(value.slice(0, MAX_ERROR_BODY), token);
}

export function sanitizeValue(value: unknown, token?: string): unknown {
	const seen = new WeakSet<object>();
	const visit = (current: unknown, key?: string): unknown => {
		if (typeof current === "string") {
			if (key && /(?:authorization|secret|token)/i.test(key)) return "[redacted]";
			return redactText(current, token);
		}
		if (!current || typeof current !== "object") return current;
		if (seen.has(current)) return "[circular]";
		seen.add(current);
		if (Array.isArray(current)) return current.map((item) => visit(item));
		return Object.fromEntries(
			Object.entries(current as Record<string, unknown>).map(([name, item]) => [
				name,
				visit(item, name),
			]),
		);
	};
	return visit(value);
}

function looksLikeAuthFailure(message: string): boolean {
	return /unauthori[sz]ed|forbidden|access denied|expired|invalid token/i.test(
		message,
	);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
	return values.find((value) => typeof value === "string" && value.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
