import type { PanelResizeChange } from '@/composables/useStablePrimeVueSplitterSizer'
import type { AppModePanelResizedMetadata } from '@/platform/telemetry/types'

export const LINEAR_VIEW_PANEL_STORAGE_KEY = {
  left: 'Comfy.LinearView.LeftPanelWidth',
  right: 'Comfy.LinearView.RightPanelWidth'
} as const

/**
 * Builds the telemetry payload for an App Mode input-panel resize, or null when
 * the resize should not be reported.
 *
 * The input/prompt panel renders opposite the sidebar, so a left sidebar puts
 * the input on the right and vice-versa. We return null unless this resize
 * actually changed the input panel's width: the splitter re-measures every
 * panel on resize-end, so dragging an unrelated gutter (or the very first
 * measurement, with no stored width) reports the input panel unchanged and must
 * not emit a spurious event.
 */
export function buildInputPanelResizeMetadata(
  changes: PanelResizeChange[],
  sidebarOnLeft: boolean
): AppModePanelResizedMetadata | null {
  const inputPanelKey = sidebarOnLeft
    ? LINEAR_VIEW_PANEL_STORAGE_KEY.right
    : LINEAR_VIEW_PANEL_STORAGE_KEY.left
  const inputChange = changes.find((c) => c.storageKey === inputPanelKey)
  if (
    !inputChange ||
    inputChange.oldWidth === null ||
    inputChange.oldWidth === inputChange.newWidth
  ) {
    return null
  }
  return {
    panel: 'input',
    direction:
      inputChange.newWidth > inputChange.oldWidth ? 'wider' : 'narrower',
    previous_width_px: inputChange.oldWidth,
    new_width_px: inputChange.newWidth,
    sidebar_location: sidebarOnLeft ? 'left' : 'right'
  }
}
