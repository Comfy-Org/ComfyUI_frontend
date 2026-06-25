const SELF_STYLED_PANEL_CONTENT_CLASS =
  'w-fit max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] border-none bg-transparent shadow-none'

/**
 * Reka chrome shared by headless workspace dialogs whose content draws its
 * own panel — neutralize the DialogContent box and shrink-wrap it around the
 * content.
 */
export const workspaceDialogProps = {
  renderer: 'reka',
  headless: true,
  contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
} as const
