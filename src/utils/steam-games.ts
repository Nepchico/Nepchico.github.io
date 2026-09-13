import { getCollection } from "astro:content";
import type { SteamGameOverride } from "../types/steamStatusConfig.ts";

let cached: Promise<Readonly<Record<string, SteamGameOverride>>> | null = null;

/** Load and validate the build-time AppID display map once per build. */
export function getSteamGameOverrides(): Promise<
	Readonly<Record<string, SteamGameOverride>>
> {
	if (cached) return cached;
	cached = (async () => {
		const entries = await getCollection("games");
		const overrides: Record<string, SteamGameOverride> = {};
		for (const entry of entries) {
			if (!entry.data.enabled) continue;
			const appId = entry.data.appId;
			if (overrides[appId]) {
				throw new Error(
					`[steam-status] Duplicate AppID ${appId} in content/games`,
				);
			}
			overrides[appId] = Object.freeze({
				appId,
				name: entry.data.name.trim(),
				text: entry.data.text.trim(),
			});
		}
		return Object.freeze(overrides);
	})();
	return cached;
}
