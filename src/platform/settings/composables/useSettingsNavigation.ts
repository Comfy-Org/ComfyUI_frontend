import { ref } from 'vue'

import type { SettingPanelType } from '@/platform/settings/types'

// A one-shot request to switch the open Settings dialog to another panel, so a
// panel's content can deep-link into a sibling panel (e.g. Overview → Members).
const requestedPanelKey = ref<SettingPanelType | null>(null)

export function useSettingsNavigation() {
  function navigateToPanel(key: SettingPanelType) {
    requestedPanelKey.value = key
  }

  return { requestedPanelKey, navigateToPanel }
}
