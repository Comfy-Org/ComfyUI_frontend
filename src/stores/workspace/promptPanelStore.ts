import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useTelemetry } from '@/platform/telemetry'
import type {
  PromptEditorClosedMetadata,
  PromptEditorOpenedMetadata
} from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { usePromptEditorExperimentStore } from '@/renderer/extensions/textEditor/promptEditorExperimentStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

export interface PromptPanelTarget {
  node: LGraphNode
  widget: IBaseWidget
}

interface PromptPanelSession {
  opened: PromptEditorOpenedMetadata
  openedAt: number
  inputCount: number
  nodeSwitchCount: number
}

/**
 * The prompt panel arm of the prompt editor experiment: a multiline text
 * widget edited across the whole right side panel, following the selection.
 */
export const usePromptPanelStore = defineStore('promptPanel', () => {
  const rightSidePanelStore = useRightSidePanelStore()
  const promptEditorExperiment = usePromptEditorExperimentStore()
  const workflowStore = useWorkflowStore()

  const target = shallowRef<PromptPanelTarget | null>(null)
  const isPromptViewShown = ref(false)
  const isEditorFocused = ref(false)
  const autofocus = ref(true)
  const isPanelHidden = ref(false)
  const isActive = computed(() => target.value !== null)

  let session: PromptPanelSession | undefined
  let releaseTarget: (() => void) | undefined

  function setTarget(next: PromptPanelTarget, graph: LGraph) {
    releaseTarget?.()
    const onNodeRemoved = ({ detail }: CustomEvent<{ node: LGraphNode }>) => {
      if (detail.node !== target.value?.node) return
      queueMicrotask(() => {
        if (target.value?.node === detail.node) close()
      })
    }
    const rootGraph = graph.rootGraph
    const graphId = graph.id
    const onConfigured = () => findTargetAgain(rootGraph, graphId)
    graph.events.addEventListener('node:before-removed', onNodeRemoved)
    rootGraph.events.addEventListener('configured', onConfigured)
    releaseTarget = () => {
      graph.events.removeEventListener('node:before-removed', onNodeRemoved)
      rootGraph.events.removeEventListener('configured', onConfigured)
    }
    target.value = next
  }

  function findTargetAgain(rootGraph: LGraph, graphId: LGraph['id']) {
    const current = target.value
    if (!current) return
    const graph: LGraph | undefined =
      rootGraph.id === graphId ? rootGraph : rootGraph.subgraphs.get(graphId)
    const node = graph?.getNodeById(current.node.id)
    const widget = node?.widgets?.find(
      ({ name }) => name === current.widget.name
    )
    if (!graph || !node || !widget) {
      close()
      return
    }
    setTarget({ node, widget }, graph)
  }

  /** Opens the panel on a widget from its Expand button; false when there is no panel to open. */
  function open(next: PromptPanelTarget): boolean {
    const graph: LGraph | null = next.node.graph
    if (!graph || rightSidePanelStore.isLegacyMenu || isPanelHidden.value)
      return false
    close()
    setTarget(next, graph)
    autofocus.value = true
    isPromptViewShown.value = true
    rightSidePanelStore.openPanel()
    session = {
      opened: {
        surface: 'panel',
        trigger: 'expand_button',
        ...promptEditorExperiment.experimentPropertiesFor('panel')
      },
      openedAt: performance.now(),
      inputCount: 0,
      nodeSwitchCount: 0
    }
    useTelemetry()?.trackPromptEditorOpened(session.opened)
    return true
  }

  /** Moves the open panel to another widget, as when its node is selected. */
  function follow(next: PromptPanelTarget) {
    const graph: LGraph | null = next.node.graph
    if (!session || !graph || next.node === target.value?.node) return
    setTarget(next, graph)
    autofocus.value = false
    session = { ...session, nodeSwitchCount: session.nodeSwitchCount + 1 }
  }

  function recordInput() {
    if (session) session = { ...session, inputCount: session.inputCount + 1 }
  }

  function reportSessionEnd(
    endReason: PromptEditorClosedMetadata['end_reason']
  ) {
    if (!session) return
    useTelemetry()?.trackPromptEditorClosed({
      ...session.opened,
      end_reason: endReason,
      duration_ms: Math.round(performance.now() - session.openedAt),
      input_count: session.inputCount,
      node_switch_count: session.nodeSwitchCount
    })
    session = undefined
  }

  function close() {
    releaseTarget?.()
    releaseTarget = undefined
    target.value = null
    isPromptViewShown.value = false
    isEditorFocused.value = false
    reportSessionEnd('close')
  }

  useEventListener(window, 'pagehide', () => reportSessionEnd('pagehide'))

  watch(
    () => rightSidePanelStore.isOpen,
    (isOpen) => {
      if (!isOpen) close()
    }
  )
  watch(() => workflowStore.activeWorkflow, close)
  rightSidePanelStore.$onAction(({ name, args }) => {
    const requestsView =
      name === 'focusSection' || (name === 'openPanel' && args[0] !== undefined)
    if (requestsView) isPromptViewShown.value = false
  })

  return {
    target,
    isPromptViewShown,
    isEditorFocused,
    autofocus,
    isPanelHidden,
    isActive,
    open,
    follow,
    recordInput,
    close
  }
})
