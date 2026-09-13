export const steamStatusStylus = `
.steam-status-card
	min-width: 0
	padding-bottom: var(--m3e-space-4)
	color: var(--on-surface)

	&__header
		display: flex
		align-items: center
		gap: var(--m3e-space-2)
		min-width: 0
		margin: var(--m3e-space-4) var(--m3e-space-4) var(--m3e-space-2)

	&__heading
		min-width: 0
		font: var(--m3e-type-title-medium)
		font-weight: 600
		color: var(--on-surface)

	&__status
		--steam-status-accent: var(--on-surface-variant)
		display: inline-flex
		align-items: center
		gap: var(--m3e-space-1)
		min-width: 0
		margin-left: auto
		padding: var(--m3e-space-1) var(--m3e-space-2)
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-high)
		color: var(--steam-status-accent)
		font: var(--m3e-type-label-small)
		font-weight: 600
		white-space: nowrap

		&::before
			content: ""
			width: 0.45rem
			height: 0.45rem
			flex: 0 0 auto
			border-radius: var(--shape-corner-full)
			background: currentColor

		&--in-game
			--steam-status-accent: var(--admonitions-color-tip)
			background: unquote("color-mix(in oklab, var(--admonitions-color-tip) 14%, var(--surface-container-low))")

		&--online
			--steam-status-accent: var(--admonitions-color-note)
			background: unquote("color-mix(in oklab, var(--admonitions-color-note) 14%, var(--surface-container-low))")

		&--error
			--steam-status-accent: var(--error)
			background: var(--error-container)

		&--loading
			width: 4.5rem
			height: 1.5rem
			background: var(--surface-container-high)
			color: transparent
			overflow: hidden

			&::before
				width: 100%
				height: 100%
				border-radius: inherit
				background: linear-gradient(90deg, transparent, var(--surface-container-highest), transparent)
				animation: steam-status-shimmer var(--m3e-duration-ambient-short) linear infinite

	&__body
		display: grid
		grid-template-columns: 3.5rem minmax(0, 1fr)
		align-items: center
		gap: var(--m3e-space-3)
		min-width: 0
		padding: 0 var(--m3e-space-4)

	&__avatar
		box-shadow: 0 0 0 1px var(--outline-variant)

	&__metadata
		display: flex
		flex-direction: column
		justify-content: center
		gap: 0.125rem
		min-width: 0

	&__marquee
		overflow: hidden
		min-width: 0
		white-space: nowrap

	&__game
		display: inline-block
		max-width: none
		font: var(--m3e-type-title-small)
		font-weight: 600
		white-space: nowrap
		will-change: auto

		&--scrolling
			will-change: transform
			animation: steam-status-marquee var(--steam-marquee-duration, var(--m3e-duration-ambient-medium)) linear infinite alternate

	&__text
		overflow: hidden
		text-overflow: ellipsis
		white-space: nowrap
		font: var(--m3e-type-body-small)
		color: var(--on-surface-variant)

@keyframes steam-status-marquee
	0%, 12%
		transform: translateX(0)
	88%, 100%
		transform: translateX(calc(-1 * var(--steam-marquee-distance)))

@keyframes steam-status-shimmer
	from
		transform: translateX(-120%)
	to
		transform: translateX(120%)

html.motion-reduced .steam-status-card__game,
html.motion-reduced .steam-status-card__status--loading::before
	animation: none

html.motion-reduced .steam-status-card__game
	max-width: 100%
	overflow: hidden
	text-overflow: ellipsis

@media (prefers-reduced-motion: reduce)
	.steam-status-card__game,
	.steam-status-card__status--loading::before
		animation: none

	.steam-status-card__game
		max-width: 100%
		overflow: hidden
		text-overflow: ellipsis
`;
