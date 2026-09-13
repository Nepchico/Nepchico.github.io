import type {
	ResolvedSteamStatusOptions,
	SteamPresence,
} from "../types/steamStatusConfig.ts";

const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_STRING_LENGTH = 512;
const RETRY_DELAY_MS = 250;

class SteamRequestError extends Error {
	constructor(
		message: string,
		readonly retryable = false,
	) {
		super(message);
		this.name = "SteamRequestError";
	}
}

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function stringValue(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value !== "string") return "";
	return value.trim().slice(0, MAX_STRING_LENGTH);
}

function firstString(...values: unknown[]): string {
	for (const value of values) {
		const text = stringValue(value);
		if (text) return text;
	}
	return "";
}

function safeImageUrl(value: unknown): string {
	const source = stringValue(value);
	if (!source) return "";
	try {
		const url = new URL(source);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: "";
	} catch {
		return "";
	}
}

function selectPlayer(payload: unknown): {
	player: Record<string, unknown>;
	wrapper: Record<string, unknown>;
} | null {
	const root = record(payload);
	if (!root) return null;
	const response = record(root.response);
	if (Array.isArray(response?.players)) {
		const player = record(response.players[0]);
		return player ? { player, wrapper: root } : null;
	}

	const data = record(root.data);
	const player = record(root.player) ?? record(data?.player) ?? data ?? root;
	return player ? { player, wrapper: root } : null;
}

function normalizeExplicitStatus(
	value: unknown,
): "in-game" | "online" | "offline" | null {
	const status = stringValue(value)
		.toLowerCase()
		.replace(/[\s_]+/g, "-");
	if (["in-game", "ingame", "playing", "game"].includes(status))
		return "in-game";
	if (
		[
			"online",
			"away",
			"busy",
			"snooze",
			"looking-to-play",
			"looking-to-trade",
		].includes(status)
	) {
		return "online";
	}
	if (["offline", "invisible"].includes(status)) return "offline";
	return null;
}

/** Normalize either Steam GetPlayerSummaries or the compact Worker response. */
export function normalizeSteamPresence(payload: unknown): SteamPresence | null {
	const selected = selectPlayer(payload);
	if (!selected) return null;
	const { player, wrapper } = selected;
	const game = record(player.game);
	const gameId = firstString(
		player.gameid,
		player.gameId,
		player.appid,
		player.appId,
		game?.id,
		game?.appId,
	);
	const gameName = firstString(
		player.gameextrainfo,
		player.gameExtraInfo,
		player.gameName,
		player.game,
		game?.name,
	);
	const explicitStatus = normalizeExplicitStatus(
		player.status ??
			player.state ??
			wrapper.status ??
			wrapper.state ??
			record(wrapper.data)?.status ??
			record(wrapper.data)?.state,
	);
	const personaState = Number(player.personastate ?? player.personaState);
	const onlineFlag = player.online ?? wrapper.online;
	const status =
		gameId || gameName || explicitStatus === "in-game"
			? "in-game"
			: (explicitStatus ??
				(onlineFlag === true ||
				(Number.isFinite(personaState) && personaState > 0)
					? "online"
					: "offline"));

	return Object.freeze({
		status,
		displayName: firstString(
			player.personaname,
			player.personaName,
			player.displayName,
			player.name,
			player.username,
			"Steam",
		),
		avatarUrl: safeImageUrl(
			player.avatarfull ??
				player.avatarFull ??
				player.avatarUrl ??
				player.avatar,
		),
		gameId,
		gameName,
	});
}

async function readLimitedJson(response: Response): Promise<unknown> {
	const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
	if (
		!contentType.includes("application/json") &&
		!contentType.includes("+json")
	) {
		throw new SteamRequestError("Steam endpoint did not return JSON");
	}
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
		throw new SteamRequestError("Steam endpoint response is too large");
	}

	if (!response.body) {
		const buffer = await response.arrayBuffer();
		if (buffer.byteLength > MAX_RESPONSE_BYTES) {
			throw new SteamRequestError("Steam endpoint response is too large");
		}
		return JSON.parse(new TextDecoder().decode(buffer));
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let total = 0;
	let body = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_RESPONSE_BYTES) {
			await reader.cancel();
			throw new SteamRequestError("Steam endpoint response is too large");
		}
		body += decoder.decode(value, { stream: true });
	}
	body += decoder.decode();
	return JSON.parse(body);
}

async function requestOnce(
	endpoint: string,
	signal: AbortSignal,
): Promise<SteamPresence> {
	let response: Response;
	try {
		response = await fetch(endpoint, {
			signal,
			cache: "no-store",
			credentials: "omit",
			headers: { Accept: "application/json" },
		});
	} catch (error) {
		if (signal.aborted) throw error;
		throw new SteamRequestError("Steam endpoint request failed", true);
	}

	if (!response.ok) {
		throw new SteamRequestError(
			`Steam endpoint returned ${response.status}`,
			response.status === 429 || response.status >= 500,
		);
	}
	let payload: unknown;
	try {
		payload = await readLimitedJson(response);
	} catch (error) {
		if (error instanceof SteamRequestError) throw error;
		throw new SteamRequestError("Steam endpoint returned invalid JSON");
	}
	const presence = normalizeSteamPresence(payload);
	if (!presence)
		throw new SteamRequestError("Steam endpoint response is invalid");
	return presence;
}

function waitForRetry(signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(resolve, RETRY_DELAY_MS);
		signal.addEventListener(
			"abort",
			() => {
				window.clearTimeout(timer);
				reject(signal.reason);
			},
			{ once: true },
		);
	});
}

const inflight = new Map<string, Promise<SteamPresence>>();

/** One deduplicated refresh with a single retry for transient failures. */
export function fetchSteamPresence(
	options: ResolvedSteamStatusOptions,
	signal?: AbortSignal,
): Promise<SteamPresence> {
	const existing = inflight.get(options.endpoint);
	if (existing) return existing;

	const request = (async () => {
		const controller = new AbortController();
		let timedOut = false;
		const onAbort = () => controller.abort(signal?.reason);
		if (signal?.aborted) onAbort();
		else signal?.addEventListener("abort", onAbort, { once: true });
		const timeout = window.setTimeout(() => {
			timedOut = true;
			controller.abort(new DOMException("Timed out", "TimeoutError"));
		}, options.timeoutMs);

		try {
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					return await requestOnce(options.endpoint, controller.signal);
				} catch (error) {
					if (
						controller.signal.aborted ||
						!(error instanceof SteamRequestError) ||
						!error.retryable ||
						attempt === 1
					) {
						throw error;
					}
					await waitForRetry(controller.signal);
				}
			}
			throw new SteamRequestError("Steam endpoint request failed");
		} catch (error) {
			if (timedOut)
				throw new SteamRequestError("Steam endpoint request timed out");
			throw error;
		} finally {
			window.clearTimeout(timeout);
			signal?.removeEventListener("abort", onAbort);
		}
	})();

	inflight.set(options.endpoint, request);
	const clear = () => {
		if (inflight.get(options.endpoint) === request)
			inflight.delete(options.endpoint);
	};
	void request.then(clear, clear);
	return request;
}
