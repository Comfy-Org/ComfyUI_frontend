import { ref } from 'vue'

// A one-shot request to switch the open Settings dialog to another panel, so a
// panel's content can deep-link into a sibling panel (e.g. Overview → Members).
const requestedPanelKey = ref<string | null>(null)

export function useSettingsNavigation() {
  function navigateToPanel(key: string) {
    requestedPanelKey.value = key
  }

  return { requestedPanelKey, navigateToPanel }
}
