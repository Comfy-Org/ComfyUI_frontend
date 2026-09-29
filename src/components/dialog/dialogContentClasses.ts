/**
 * Shrink-wrap the Reka DialogContent around the content's intrinsic width,
 * like the auto-sized PrimeVue root it replaces.
 */
export const HUG_CONTENT_CLASS =
  'w-fit max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)]'

/**
 * Reka chrome for headless dialogs whose content draws its own panel
 * (background/border/rounding) — neutralize the DialogContent box and
 * shrink-wrap it around the content.
 */
export const SELF_STYLED_PANEL_CONTENT_CLASS = `${HUG_CONTENT_CLASS} border-none bg-transparent shadow-none`

export const SELF_STYLED_PANEL_DIALOG_PROPS = {
  renderer: 'reka',
  headless: true,
  contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
} as const
