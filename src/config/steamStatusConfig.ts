import type {
	ResolvedSteamStatusOptions,
	SteamStatusConfig,
} from "../types/steamStatusConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * Steam status sidebar configuration.
 *
 * The browser only talks to a Cloudflare Worker. Keep the Steam Web API key in
 * the Worker secret store; never put it in this repository or in endpoint
 * query parameters.
 */
export const steamStatusConfig: SteamStatusConfig = withUserConfig(
	"steamStatus",
	{
		enable: false,
		endpoint: "",
		pollIntervalMs: 60_000,
		timeoutMs: 8_000,
	},
);

const HTTP_ENDPOINT = /^https?:\/\//i;

function clampInteger(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function normalizeEndpoint(value: string): string | null {
	const endpoint = value.trim();
	if (!endpoint) return null;
	if (endpoint.startsWith("/") && !endpoint.startsWith("//")) return endpoint;
	if (!HTTP_ENDPOINT.test(endpoint)) return null;
	try {
		const url = new URL(endpoint);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}

export function resolveSteamStatusOptions(
	config: SteamStatusConfig,
): ResolvedSteamStatusOptions | null {
	if (!config.enable) return null;
	const endpoint = normalizeEndpoint(config.endpoint);
	if (!endpoint) return null;

	return Object.freeze({
		endpoint,
		pollIntervalMs: clampInteger(
			config.pollIntervalMs,
			60_000,
			15_000,
			15 * 60_000,
		),
		timeoutMs: clampInteger(config.timeoutMs, 8_000, 1_000, 8_000),
	});
}
