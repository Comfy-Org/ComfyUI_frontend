import { computed, ref } from 'vue'

// Shared state for workspace
const _workspaceName = ref<string | null>(null)
const _activeTab = ref<string>('general')

/**
 * Composable for handling workspace data
 * TODO: Replace stubbed data with actual API call
 */
export function useWorkspace() {
  const workspaceName = computed(() => _workspaceName.value)
  const activeTab = computed(() => _activeTab.value)

  function setActiveTab(tab: string | number) {
    _activeTab.value = String(tab)
  }

  return {
    workspaceName,
    activeTab,
    setActiveTab
  }
}
