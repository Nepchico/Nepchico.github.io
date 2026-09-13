import { expect, test } from "@playwright/test";
import { resolveSteamStatusOptions } from "../../src/config/steamStatusConfig";
import { normalizeSteamPresence } from "../../src/utils/steam-status";

test.describe("Steam status core", () => {
	test("normalizes the raw GetPlayerSummaries response", () => {
		const presence = normalizeSteamPresence({
			response: {
				players: [
					{
						personaname: "Nepchico",
						avatarfull: "https://example.com/avatar.jpg",
						personastate: 1,
						gameid: "730",
						gameextrainfo: "Counter-Strike 2",
					},
				],
			},
		});

		expect(presence).toEqual({
			status: "in-game",
			displayName: "Nepchico",
			avatarUrl: "https://example.com/avatar.jpg",
			gameId: "730",
			gameName: "Counter-Strike 2",
		});
	});

	test("normalizes a compact Worker response and strips unsafe avatar URLs", () => {
		const presence = normalizeSteamPresence({
			platform: "steam",
			displayName: "Nepchico",
			online: true,
			state: "in-game",
			game: "Aperture Desk Job",
			gameId: "1902490",
			avatar: "javascript:alert(1)",
		});

		expect(presence).toEqual({
			status: "in-game",
			displayName: "Nepchico",
			avatarUrl: "",
			gameId: "1902490",
			gameName: "Aperture Desk Job",
		});
	});

	test("validates the endpoint and clamps network settings", () => {
		expect(
			resolveSteamStatusOptions({
				enable: true,
				endpoint: "/steam",
				pollIntervalMs: 100,
				timeoutMs: 20_000,
			}),
		).toEqual({ endpoint: "/steam", pollIntervalMs: 15_000, timeoutMs: 8_000 });
		expect(
			resolveSteamStatusOptions({
				enable: true,
				endpoint: "javascript:alert(1)",
			}),
		).toBeNull();
		expect(
			resolveSteamStatusOptions({ enable: false, endpoint: "/steam" }),
		).toBeNull();
	});
});
