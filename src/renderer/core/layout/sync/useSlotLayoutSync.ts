import { tryOnScopeDispose } from '@vueuse/core'
import { ref } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SlotPositionContext } from '@/renderer/core/canvas/litegraph/slotCalculations'
import { registerNodeSlots } from '@/renderer/core/layout/slots/register'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

function computeAndRegisterSlots(node: LGraphNode): void {
  const nodeId = String(node.id)
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value

  // Fallback to live node values if layout not ready
  const nodeX = nodeLayout?.position.x ?? node.pos[0]
  const nodeY = nodeLayout?.position.y ?? node.pos[1]
  const nodeWidth = nodeLayout?.size.width ?? node.size[0]
  const nodeHeight = nodeLayout?.size.height ?? node.size[1]

  // Ensure concrete slots & arrange when needed for accurate positions
  node._setConcreteSlots()
  const collapsed = node.flags.collapsed ?? false
  if (!collapsed) {
    node.arrange()
  }

  const context: SlotPositionContext = {
    nodeX,
    nodeY,
    nodeWidth,
    nodeHeight,
    collapsed,
    collapsedWidth: node._collapsed_width,
    slotStartY: node.constructor.slot_start_y,
    inputs: node.inputs,
    outputs: node.outputs,
    widgets: node.widgets
  }

  registerNodeSlots(nodeId, context)
}

export function useSlotLayoutSync() {
  const unsubscribeLayoutChange = ref<() => void>()
  const restoreHandlers = ref<() => void>()

  /**
   * Attempt to start slot layout sync with full event-driven functionality
   * @param canvas LiteGraph canvas instance
   * @returns true if sync was actually started, false if early-returned
   */
  function attemptStart(canvas: LGraphCanvas): boolean {
    // When Vue nodes are enabled, slot DOM registers exact positions.
    // Skip calculated registration to avoid conflicts.
    if (LiteGraph.vueNodesMode) {
      return false
    }
    const graph = canvas?.graph
    if (!graph) return false

    // Initial registration for all nodes in the current graph
    for (const node of graph.nodes) {
      computeAndRegisterSlots(node)
    }

    // Layout changes → recompute slots for changed nodes
    unsubscribeLayoutChange.value?.()
    unsubscribeLayoutChange.value = layoutStore.onChange((change) => {
      for (const nodeId of change.nodeIds) {
        const node = graph.getNodeById(parseInt(nodeId))
        if (node) {
          computeAndRegisterSlots(node)
        }
      }
    })

    // LiteGraph event hooks
    const origNodeAdded = graph.onNodeAdded
    const origNodeRemoved = graph.onNodeRemoved
    const origTrigger = graph.onTrigger
    const origAfterChange = graph.onAfterChange

    graph.onNodeAdded = (node: LGraphNode) => {
      computeAndRegisterSlots(node)
      if (origNodeAdded) {
        origNodeAdded.call(graph, node)
      }
    }

    graph.onNodeRemoved = (node: LGraphNode) => {
      layoutStore.deleteNodeSlotLayouts(String(node.id))
      if (origNodeRemoved) {
        origNodeRemoved.call(graph, node)
      }
    }

    graph.onTrigger = (event) => {
      if (
        event.type === 'node:property:changed' &&
        event.property === 'flags.collapsed'
      ) {
        const node = graph.getNodeById(parseInt(String(event.nodeId)))
        if (node) {
          computeAndRegisterSlots(node)
        }
      }

      // Chain to original handler
      origTrigger?.(event)
    }

    graph.onAfterChange = (graph: any, node?: any) => {
      if (node && node.id) {
        computeAndRegisterSlots(node)
      }
      if (origAfterChange) {
        origAfterChange.call(graph, graph, node)
      }
    }

    // Store cleanup function
    restoreHandlers.value = () => {
      graph.onNodeAdded = origNodeAdded || undefined
      graph.onNodeRemoved = origNodeRemoved || undefined
      // Only restore onTrigger if Vue nodes are not active
      // Vue node manager sets its own onTrigger handler
      if (!LiteGraph.vueNodesMode) {
        graph.onTrigger = origTrigger || undefined
      }
      graph.onAfterChange = origAfterChange || undefined
    }

    return true
  }

  function stop(): void {
    unsubscribeLayoutChange.value?.()
    unsubscribeLayoutChange.value = undefined
    restoreHandlers.value?.()
    restoreHandlers.value = undefined
  }

  tryOnScopeDispose(stop)

  return {
    attemptStart,
    stop
  }
}
