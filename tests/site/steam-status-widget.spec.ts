import { expect, test } from "@playwright/test";
import { sidebarConfig } from "../../src/config/sidebarConfig";
import {
	resolveSteamStatusOptions,
	steamStatusConfig,
} from "../../src/config/steamStatusConfig";

const enabled =
	resolveSteamStatusOptions(steamStatusConfig) !== null &&
	sidebarConfig.components.some(
		(widget) => widget.type === "steam-status" && widget.enable,
	);

test("Steam sidebar renders Worker data on the homepage", async ({ page }) => {
	test.skip(!enabled, "Steam status widget is disabled");
	await page.route("**/steam", (route) =>
		route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({
				response: {
					players: [
						{
							personaname: "Nepchico",
							personastate: 1,
							gameid: "999999",
							gameextrainfo:
								"A Very Long Steam Game Title Used for Marquee Testing",
						},
					],
				},
			}),
		}),
	);

	await page.goto("/");
	const widget = page.locator("[data-steam-status]");
	await expect(widget).toBeVisible();
	await expect(
		widget.locator(".steam-status-card__status--in-game"),
	).toBeVisible();
	await expect(widget.locator(".steam-status-card__game")).toContainText(
		"A Very Long Steam Game Title",
	);
	await expect(widget.locator(".steam-status-card__game")).toHaveClass(
		/--scrolling/,
	);
});
