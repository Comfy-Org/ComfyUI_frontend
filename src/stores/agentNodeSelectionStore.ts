import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Raw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

export const useAgentNodeSelectionStore = defineStore(
  'agentNodeSelection',
  () => {
    const canvasStore = useCanvasStore()

    const isActive = ref(false)
    const referencedNodes = ref<Raw<LGraphNode>[]>([])
    let restoreAllowDragnodes: boolean | undefined

    /** Nodes in the current graph, available as `@`-mention candidates. */
    const graphNodes = computed<LGraphNode[]>(() =>
      (canvasStore.currentGraph?.nodes ?? []).filter(isLGraphNode)
    )

    watch(
      () => canvasStore.selectedItems,
      (items) => {
        if (!isActive.value) return
        referencedNodes.value = items.filter(isLGraphNode)
      }
    )

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
      enter,
      exit,
      addNode,
      removeNode,
      clear
    }
  }
)
