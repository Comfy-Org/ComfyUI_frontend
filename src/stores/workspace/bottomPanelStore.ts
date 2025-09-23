import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useShortcutsTab } from '@/composables/bottomPanelTabs/useShortcutsTab'
import {
  useCommandTerminalTab,
  useLogsTerminalTab
} from '@/composables/bottomPanelTabs/useTerminalTabs'
import { useCommandStore } from '@/stores/commandStore'
import { ComfyExtension } from '@/types/comfy'
import type { BottomPanelExtension } from '@/types/extensionTypes'
import { isElectron } from '@/utils/envUtil'

type PanelType = 'terminal' | 'shortcuts'

interface PanelState {
  tabs: BottomPanelExtension[]
  activeTabId: string
  visible: boolean
}

export const useBottomPanelStore = defineStore('bottomPanel', () => {
  // Multi-panel state
  const panels = ref<Record<PanelType, PanelState>>({
    terminal: { tabs: [], activeTabId: '', visible: false },
    shortcuts: { tabs: [], activeTabId: '', visible: false }
  })

  const activePanel = ref<PanelType | null>(null)

  // Computed properties for active panel
  const activePanelState = computed(() =>
    activePanel.value ? panels.value[activePanel.value] : null
  )

  const activeBottomPanelTab = computed<BottomPanelExtension | null>(() => {
    const state = activePanelState.value
    if (!state) return null
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
  })

  const bottomPanelVisible = computed({
    get: () => !!activePanel.value,
    set: (visible: boolean) => {
      if (!visible) {
        activePanel.value = null
      }
    }
  })
  const bottomPanelTabs = computed(() => activePanelState.value?.tabs ?? [])
  const activeBottomPanelTabId = computed({
    get: () => activePanelState.value?.activeTabId ?? '',
    set: (tabId: string) => {
      const state = activePanelState.value
      if (state) {
        state.activeTabId = tabId
      }
    }
  })

  const togglePanel = (panelType: PanelType) => {
    const panel = panels.value[panelType]
    if (panel.tabs.length === 0) return

    if (activePanel.value === panelType) {
      // Hide current panel
      activePanel.value = null
    } else {
      // Show target panel
      activePanel.value = panelType
      if (!panel.activeTabId && panel.tabs.length > 0) {
        panel.activeTabId = panel.tabs[0].id
      }
    }
  }

  const toggleBottomPanel = () => {
    // Legacy method - toggles terminal panel
    togglePanel('terminal')
  }

  const setActiveTab = (tabId: string) => {
    const state = activePanelState.value
    if (state) {
      state.activeTabId = tabId
    }
  }

  const toggleBottomPanelTab = (tabId: string) => {
    // Find which panel contains this tab
    for (const [panelType, panel] of Object.entries(panels.value)) {
      const tab = panel.tabs.find((t) => t.id === tabId)
      if (tab) {
        if (activePanel.value === panelType && panel.activeTabId === tabId) {
          activePanel.value = null
        } else {
          activePanel.value = panelType as PanelType
          panel.activeTabId = tabId
        }
        return
      }
    }
  }
  const registerBottomPanelTab = (tab: BottomPanelExtension) => {
    const targetPanel = tab.targetPanel ?? 'terminal'
    const panel = panels.value[targetPanel]

    panel.tabs = [...panel.tabs, tab]
    if (panel.tabs.length === 1) {
      panel.activeTabId = tab.id
    }

    const tabName = tab.title || tab.titleKey || tab.id
    useCommandStore().registerCommand({
      id: `Workspace.ToggleBottomPanelTab.${tab.id}`,
      icon: 'pi pi-list',
      label: `Toggle ${tabName} Bottom Panel`,
      category: 'view-controls' as const,
      function: () => toggleBottomPanelTab(tab.id),
      source: 'System'
    })
  }

  const registerCoreBottomPanelTabs = () => {
    registerBottomPanelTab(useLogsTerminalTab())
    if (isElectron()) {
      registerBottomPanelTab(useCommandTerminalTab())
    }
    useShortcutsTab().forEach(registerBottomPanelTab)
  }

  const registerExtensionBottomPanelTabs = (extension: ComfyExtension) => {
    if (extension.bottomPanelTabs) {
      extension.bottomPanelTabs.forEach(registerBottomPanelTab)
    }
  }

  return {
    // Multi-panel API
    panels,
    activePanel,
    togglePanel,

    bottomPanelVisible,
    toggleBottomPanel,
    bottomPanelTabs,
    activeBottomPanelTab,
    activeBottomPanelTabId,
    setActiveTab,
    toggleBottomPanelTab,
    registerBottomPanelTab,
    registerCoreBottomPanelTabs,
    registerExtensionBottomPanelTabs
  }
})
