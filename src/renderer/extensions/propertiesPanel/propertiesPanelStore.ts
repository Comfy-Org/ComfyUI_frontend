import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useErrorsTabRequestStore } from '@/platform/workflowErrors/panel/errorsTabRequestStore'

export type PropertiesPanelTab =
  | 'parameters'
  | 'nodes'
  | 'settings'
  | 'info'
  | 'subgraph'
  | 'errors'

type PropertiesPanelSection = 'advanced-inputs'

/**
 * Store for managing the properties panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const usePropertiesPanelStore = defineStore('propertiesPanel', () => {
  const settingStore = useSettingStore()
  const errorsTabRequestStore = useErrorsTabRequestStore()

  const isAvailable = computed(
    () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
  )

  const isOpen = computed({
    get: () =>
      isAvailable.value && settingStore.get('Comfy.RightSidePanel.IsOpen'),
    set: (value: boolean) =>
      settingStore.set('Comfy.RightSidePanel.IsOpen', value)
  })
  const activeTab = ref<PropertiesPanelTab>('parameters')
  const isEditingSubgraph = computed(() => activeTab.value === 'subgraph')
  const focusedSection = ref<PropertiesPanelSection | null>(null)

  watch(isAvailable, (available) => {
    if (!available) void settingStore.set('Comfy.RightSidePanel.IsOpen', false)
  })

  watch([isOpen, activeTab], ([open, tab]) => {
    if (!open || tab !== 'errors') errorsTabRequestStore.clearRequests()
  })

  /** Opens the panel, optionally on a tab; returns false when it cannot open. */
  function openPanel(tab?: PropertiesPanelTab): boolean {
    if (!isAvailable.value) return false
    isOpen.value = true
    if (tab) activeTab.value = tab
    return true
  }

  function closePanel() {
    isOpen.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  /**
   * Focus on a specific section in the properties panel.
   * This will open the panel, switch to the parameters tab, and signal
   * the component to expand and scroll to the section.
   */
  function focusSection(section: PropertiesPanelSection) {
    openPanel('parameters')
    focusedSection.value = section
  }

  /**
   * Clear the focused section after it has been handled.
   */
  function clearFocusedSection() {
    focusedSection.value = null
  }

  return {
    isAvailable,
    isOpen,
    activeTab,
    isEditingSubgraph,
    focusedSection,
    openPanel,
    closePanel,
    togglePanel,
    focusSection,
    clearFocusedSection
  }
})
