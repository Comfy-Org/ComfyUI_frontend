import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

export type RightSidePanelTab =
  | 'parameters'
  | 'nodes'
  | 'settings'
  | 'info'
  | 'subgraph'

type RightSidePanelSection = 'advanced-inputs' | string

/**
 * Store for managing the right side panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const useRightSidePanelStore = defineStore('rightSidePanel', () => {
  const settingStore = useSettingStore()

  const isOpen = computed({
    get: () => settingStore.get('Comfy.RightSidePanel.IsOpen'),
    set: (value: boolean) =>
      settingStore.set('Comfy.RightSidePanel.IsOpen', value)
  })
  const activeTab = ref<RightSidePanelTab>('parameters')
  const isEditingSubgraph = computed(() => activeTab.value === 'subgraph')
  const focusedSection = ref<RightSidePanelSection | null>(null)

  function openPanel(tab?: RightSidePanelTab) {
    isOpen.value = true
    if (tab) {
      activeTab.value = tab
    }
  }

  function closePanel() {
    isOpen.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  /**
   * Focus on a specific section in the right side panel.
   * This will open the panel, switch to the parameters tab, scroll to the section,
   * and expand it if collapsed.
   */
  function focusSection(section: RightSidePanelSection) {
    openPanel('parameters')
    focusedSection.value = section

    // Scroll to the section after a short delay to ensure the panel is open
    setTimeout(() => {
      const sectionElement = document.querySelector(
        `[data-section="${section}"]`
      )
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 300)
  }

  /**
   * Clear the focused section after it has been handled.
   */
  function clearFocusedSection() {
    focusedSection.value = null
  }

  return {
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
