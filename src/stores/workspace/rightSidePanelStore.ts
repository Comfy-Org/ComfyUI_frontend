import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'

export type RightSidePanelTab =
  | 'parameters'
  | 'nodes'
  | 'settings'
  | 'info'
  | 'subgraph'
  | 'errors'
  | 'text'

type RightSidePanelSection = 'advanced-inputs'

export interface TextEditorTarget {
  node: LGraphNode
  widget: IBaseWidget
}

/**
 * Store for managing the right side panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const useRightSidePanelStore = defineStore('rightSidePanel', () => {
  const settingStore = useSettingStore()

  const isLegacyMenu = computed(
    () => settingStore.get('Comfy.UseNewMenu') === 'Disabled'
  )

  const isOpen = computed({
    get: () =>
      !isLegacyMenu.value && settingStore.get('Comfy.RightSidePanel.IsOpen'),
    set: (value: boolean) =>
      settingStore.set('Comfy.RightSidePanel.IsOpen', value)
  })
  const activeTab = ref<RightSidePanelTab>('parameters')
  const isEditingSubgraph = computed(() => activeTab.value === 'subgraph')
  const focusedSection = ref<RightSidePanelSection | null>(null)
  /**
   * Graph node ID to focus in the errors tab.
   * Set by SectionWidgets when the user clicks "See Error", consumed and
   * cleared by TabErrors after expanding the relevant error group.
   */
  const focusedErrorNodeId = ref<string | null>(null)
  const textEditorTarget = shallowRef<TextEditorTarget | null>(null)
  const isTextEditorActive = computed(
    () => activeTab.value === 'text' && textEditorTarget.value !== null
  )
  const isTextEditorFocused = ref(false)

  // Auto-close panel when switching to legacy menu mode
  watch(isLegacyMenu, (legacy) => {
    if (legacy) {
      void settingStore.set('Comfy.RightSidePanel.IsOpen', false)
    }
  })

  function openPanel(tab?: RightSidePanelTab) {
    if (isLegacyMenu.value) return
    isOpen.value = true
    if (tab) {
      activeTab.value = tab
    }
  }

  function closePanel() {
    isOpen.value = false
  }

  let releaseTextEditorTarget: (() => void) | undefined

  /**
   * Opens the panel's Text tab on a multiline text widget. The tab closes when
   * the widget's node is removed or its graph reloads.
   */
  function openTextEditor(target: TextEditorTarget) {
    closeTextEditor()
    const graph: LGraph | null = target.node.graph
    if (!graph) return

    const onNodeRemoved = ({ detail }: CustomEvent<{ node: LGraphNode }>) => {
      if (detail.node === target.node) closeTextEditor()
    }
    const rootEvents = graph.rootGraph.events
    graph.events.addEventListener('node:removed', onNodeRemoved)
    rootEvents.addEventListener('configured', closeTextEditor)
    releaseTextEditorTarget = () => {
      graph.events.removeEventListener('node:removed', onNodeRemoved)
      rootEvents.removeEventListener('configured', closeTextEditor)
    }

    textEditorTarget.value = target
    openPanel('text')
  }

  function closeTextEditor() {
    releaseTextEditorTarget?.()
    releaseTextEditorTarget = undefined
    textEditorTarget.value = null
    isTextEditorFocused.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  /**
   * Focus on a specific section in the right side panel.
   * This will open the panel, switch to the parameters tab, and signal
   * the component to expand and scroll to the section.
   */
  function focusSection(section: RightSidePanelSection) {
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
    isOpen,
    activeTab,
    isEditingSubgraph,
    focusedSection,
    focusedErrorNodeId,
    textEditorTarget,
    isTextEditorActive,
    isTextEditorFocused,
    openPanel,
    closePanel,
    openTextEditor,
    closeTextEditor,
    togglePanel,
    focusSection,
    clearFocusedSection
  }
})
