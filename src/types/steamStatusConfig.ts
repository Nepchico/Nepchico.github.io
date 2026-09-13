/** Steam presence states exposed by the sidebar widget. */
export type SteamPresenceStatus = "in-game" | "online" | "offline" | "error";

/** Build-time content override stored under content/games/*.md. */
export interface SteamGameOverride {
	readonly appId: string;
	readonly name: string;
	readonly text: string;
}

/** Whitelisted player fields consumed by the UI. */
export interface SteamPresence {
	readonly status: Exclude<SteamPresenceStatus, "error">;
	readonly displayName: string;
	readonly avatarUrl: string;
	readonly gameId: string;
	readonly gameName: string;
}

export interface SteamStatusConfig {
	/** Global feature switch. The sidebar switch must also be enabled. */
	readonly enable: boolean;
	/** Cloudflare Worker endpoint, for example /steam or https://api.example.com/steam. */
	readonly endpoint: string;
	/** Refresh interval in milliseconds. Values are clamped to 15s–15min. */
	readonly pollIntervalMs?: number;
	/** Per-refresh timeout in milliseconds. Values are clamped to 1s–8s. */
	readonly timeoutMs?: number;
}

export interface ResolvedSteamStatusOptions {
	readonly endpoint: string;
	readonly pollIntervalMs: number;
	readonly timeoutMs: number;
}
