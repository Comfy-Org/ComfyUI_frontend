import { useTelemetry } from '@/platform/telemetry'
import type { RightSidePanelTab } from '@/stores/workspace/rightSidePanelStore'

/**
 * Tabs whose opening we want discoverability telemetry for, mapped to the
 * button_id reported on `trackUiButtonClicked`. Tabs not listed here are
 * intentionally left untracked.
 */
const TAB_OPENED_BUTTON_IDS: Partial<Record<RightSidePanelTab, string>> = {
  settings: 'right_side_panel_settings_tab_opened',
  info: 'right_side_panel_info_tab_opened'
}

/**
 * Fires a `trackUiButtonClicked` event when the right side panel switches to
 * a tab tracked in {@link TAB_OPENED_BUTTON_IDS}. No-op for any other tab.
 */
export function trackRightSidePanelTabOpened(tab: RightSidePanelTab): void {
  const buttonId = TAB_OPENED_BUTTON_IDS[tab]
  if (!buttonId) return

  useTelemetry()?.trackUiButtonClicked({
    button_id: buttonId,
    element_group: 'right_side_panel'
  })
}
