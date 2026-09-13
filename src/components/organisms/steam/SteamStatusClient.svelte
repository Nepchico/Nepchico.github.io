<script lang="ts">
import AccentBar from "@components/atoms/display/AccentBar.svelte";
import Avatar from "@components/atoms/display/Avatar.svelte";
import Card from "@components/atoms/display/Card.svelte";
import { fetchSteamPresence } from "@utils/steam-status";
import { onMount } from "svelte";
import type {
	ResolvedSteamStatusOptions,
	SteamGameOverride,
	SteamPresence,
	SteamPresenceStatus,
} from "@/types/steamStatusConfig";

interface Labels {
	title: string;
	loading: string;
	unavailable: string;
	statuses: Record<SteamPresenceStatus, string>;
}

interface Props {
	options: ResolvedSteamStatusOptions;
	gameOverrides: Record<string, SteamGameOverride>;
	labels: Labels;
	class?: string;
	style?: string;
}

let {
	options,
	gameOverrides,
	labels,
	class: className = "",
	style = "",
}: Props = $props();

let cardEl = $state<HTMLElement | null>(null);
let titleViewport = $state<HTMLElement | null>(null);
let titleText = $state<HTMLElement | null>(null);
let presence = $state<SteamPresence | null>(null);
let failed = $state(false);
let loading = $state(true);
let marqueeDistance = $state(0);
let marqueeDuration = $state("var(--m3e-duration-ambient-short)");

const state = $derived<SteamPresenceStatus>(
	failed ? "error" : (presence?.status ?? "offline"),
);
const override = $derived(
	presence?.gameId ? gameOverrides[presence.gameId] : undefined,
);
const gameTitle = $derived(
	loading && !presence && !failed
		? labels.loading
		: state === "error"
			? labels.unavailable
			: presence?.gameId || presence?.gameName
				? override?.name || presence?.gameName || labels.unavailable
				: presence?.displayName || labels.unavailable,
);
const customText = $derived(presence?.gameId ? (override?.text ?? "") : "");
const statusLabel = $derived(labels.statuses[state]);

function measureTitle(): void {
	if (!titleViewport || !titleText) {
		marqueeDistance = 0;
		return;
	}
	marqueeDistance = Math.max(
		0,
		Math.ceil(titleText.scrollWidth - titleViewport.clientWidth),
	);
	marqueeDuration =
		marqueeDistance > 180
			? "var(--m3e-duration-ambient-extra-long)"
			: marqueeDistance > 80
				? "var(--m3e-duration-ambient-long)"
				: "var(--m3e-duration-ambient-short)";
}

$effect(() => {
	void gameTitle;
	queueMicrotask(measureTitle);
});

onMount(() => {
	let active = false;
	let disposed = false;
	let generation = 0;
	let refreshTimer: number | null = null;
	let requestController: AbortController | null = null;
	const wrapper = cardEl?.closest<HTMLElement>("[data-sidebar-pages]") ?? null;

	const schedule = () => {
		if (!active || disposed) return;
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(
			() => void refresh(),
			options.pollIntervalMs,
		);
	};

	const refresh = async () => {
		if (!active || disposed || requestController) return;
		const currentGeneration = ++generation;
		requestController = new AbortController();
		if (!presence) loading = true;
		try {
			const next = await fetchSteamPresence(options, requestController.signal);
			if (!active || disposed || currentGeneration !== generation) return;
			presence = next;
			failed = false;
		} catch {
			if (
				!active ||
				disposed ||
				requestController.signal.aborted ||
				currentGeneration !== generation
			)
				return;
			failed = true;
			presence = null;
		} finally {
			if (currentGeneration === generation) {
				requestController = null;
				loading = false;
				schedule();
			}
		}
	};

	const stop = () => {
		generation += 1;
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
		refreshTimer = null;
		requestController?.abort();
		requestController = null;
	};

	const syncActivity = () => {
		const next =
			document.visibilityState === "visible" &&
			!wrapper?.classList.contains("hidden");
		if (next === active) return;
		active = next;
		if (active) void refresh();
		else stop();
	};

	const pageObserver = wrapper ? new MutationObserver(syncActivity) : null;
	pageObserver?.observe(wrapper, {
		attributes: true,
		attributeFilter: ["class"],
	});
	document.addEventListener("visibilitychange", syncActivity);

	const sizeObserver =
		typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(measureTitle);
	if (titleViewport) sizeObserver?.observe(titleViewport);
	if (titleText) sizeObserver?.observe(titleText);
	measureTitle();
	syncActivity();

	return () => {
		disposed = true;
		active = false;
		stop();
		pageObserver?.disconnect();
		sizeObserver?.disconnect();
		document.removeEventListener("visibilitychange", syncActivity);
	};
});
</script>

<div bind:this={cardEl} data-steam-status class={className} {style}>
	<Card color="var(--card-bg)" radius="l" class="steam-status-card">
		<div class="steam-status-card__header">
			<AccentBar size="small" />
			<span class="steam-status-card__heading">{labels.title}</span>
			{#if loading && !presence && !failed}
				<span class="steam-status-card__status steam-status-card__status--loading" aria-label={labels.loading}></span>
			{:else}
				<span class={`steam-status-card__status steam-status-card__status--${state}`} aria-live="polite">
					{statusLabel}
				</span>
			{/if}
		</div>

		<div class="steam-status-card__body" aria-busy={loading}>
			<Avatar src={presence?.avatarUrl ?? ""} alt="" fallback="S" size={56} shape="rounded" class="steam-status-card__avatar" />
			<div class="steam-status-card__metadata">
				<div class="steam-status-card__marquee" bind:this={titleViewport} title={gameTitle}>
					<strong
						bind:this={titleText}
						class={`steam-status-card__game${marqueeDistance > 0 ? " steam-status-card__game--scrolling" : ""}`}
						style={`--steam-marquee-distance: ${marqueeDistance}px; --steam-marquee-duration: ${marqueeDuration}`}
					>{gameTitle}</strong>
				</div>
				{#if customText}
					<span class="steam-status-card__text" title={customText}>{customText}</span>
				{/if}
			</div>
		</div>
	</Card>
</div>
