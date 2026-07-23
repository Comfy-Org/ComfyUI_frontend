import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Raw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Matches the topbar action bars' `duration-300` transition (TopMenuSection.vue).
 */
const ACTION_BARS_TRANSITION_MS = 300
/**
 * Matches NodeSelectionModeBanner.vue's `slide-down` transition.
 */
const BANNER_TRANSITION_MS = 150

export const useAgentNodeSelectionStore = defineStore(
  'agentNodeSelection',
  () => {
    const canvasStore = useCanvasStore()
    const workflowStore = useWorkflowStore()

    const isActive = ref(false)
    const referencedNodes = ref<Raw<LGraphNode>[]>([])
    let restoreAllowDragnodes: boolean | undefined

    /**
     * Nodes in the current graph, available as `@`-mention candidates.
     * Switching workflows re-`configure`s the same root `LGraph` instance
     * rather than replacing it, so `currentGraph` alone wouldn't change and
     * this would keep returning the outgoing workflow's nodes - depending on
     * `activeWorkflow` too ensures every switch is picked up.
     */
    const graphNodes = computed<LGraphNode[]>(() => {
      void workflowStore.activeWorkflow
      return (canvasStore.currentGraph?.nodes ?? []).filter(isLGraphNode)
    })

    watch(
      () => canvasStore.selectedItems,
      (items) => {
        if (!isActive.value) return
        referencedNodes.value = items.filter(isLGraphNode)
      }
    )

    // Sequence the topbar action bars and the notification banner so they
    // never animate at the same time: on entry the action bars retract
    // before the banner drops down; on exit the banner retracts before the
    // action bars slide back in.
    const isActionBarsHidden = ref(false)
    const isBannerVisible = ref(false)
    let transitionTimeoutId: ReturnType<typeof setTimeout> | undefined

    watch(isActive, (active) => {
      clearTimeout(transitionTimeoutId)
      if (active) {
        isActionBarsHidden.value = true
        transitionTimeoutId = setTimeout(() => {
          isBannerVisible.value = true
        }, ACTION_BARS_TRANSITION_MS)
      } else {
        isBannerVisible.value = false
        transitionTimeoutId = setTimeout(() => {
          isActionBarsHidden.value = false
        }, BANNER_TRANSITION_MS)
      }
    })

    function enter() {
      isActive.value = true
      referencedNodes.value = canvasStore.selectedItems.filter(isLGraphNode)

      const canvas = canvasStore.canvas
      if (!canvas) return
      restoreAllowDragnodes = canvas.allow_dragnodes
      canvas.allow_dragnodes = false
      canvas.selectOnly = true
    }

    function exit() {
      isActive.value = false

      const canvas = canvasStore.canvas
      if (!canvas) return
      canvas.allow_dragnodes = restoreAllowDragnodes ?? true
      canvas.selectOnly = false
    }

    function addNode(node: LGraphNode) {
      if (!referencedNodes.value.some((n) => n.id === node.id)) {
        referencedNodes.value = [...referencedNodes.value, node]
      }

      const canvas = canvasStore.canvas
      if (canvas && !canvas.selectedItems.has(node)) {
        canvas.select(node)
        canvasStore.updateSelectedItems()
      }
    }

    function removeNode(node: LGraphNode) {
      referencedNodes.value = referencedNodes.value.filter(
        (n) => n.id !== node.id
      )

      const canvas = canvasStore.canvas
      if (canvas?.selectedItems.has(node)) {
        canvas.deselect(node)
        canvasStore.updateSelectedItems()
      }
    }

    function clear() {
      referencedNodes.value = []
    }

    return {
      isActive,
      referencedNodes,
      graphNodes,
      isActionBarsHidden,
      isBannerVisible,
      enter,
      exit,
      addNode,
      removeNode,
      clear
    }
  }
)
