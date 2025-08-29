/**
 * Composable for managing slot layout registration
 *
 * Implements event-driven slot registration decoupled from the draw cycle.
 * Registers slots once on initial load and keeps them updated when necessary.
 */
import { onUnmounted } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { type SlotPositionContext } from '@/renderer/core/canvas/litegraph/SlotCalculations'
import { registerNodeSlots } from '@/renderer/core/layout/slots/register'
import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'

/**
 * Compute and register slot layouts for a node
 * @param node LiteGraph node to process
 */
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

/**
 * Composable for managing slot layout registration
 */
export function useSlotLayoutSync() {
  let unsubscribeLayoutChange: (() => void) | null = null
  let restoreHandlers: (() => void) | null = null

  /**
   * Start slot layout sync with full event-driven functionality
   * @param canvas LiteGraph canvas instance
   */
  function start(canvas: LGraphCanvas): void {
    // When Vue nodes are enabled, slot DOM registers exact positions.
    // Skip calculated registration to avoid conflicts.
    if (LiteGraph.vueNodesMode) {
      return
    }
    const graph = canvas?.graph
    if (!graph) return

    // Initial registration for all nodes in the current graph
    for (const node of graph._nodes) {
      computeAndRegisterSlots(node)
    }

    // Layout changes → recompute slots for changed nodes
    unsubscribeLayoutChange = layoutStore.onChange((change) => {
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

    graph.onTrigger = (action: string, param: any) => {
      if (
        action === 'node:property:changed' &&
        param?.property === 'flags.collapsed'
      ) {
        const node = graph.getNodeById(parseInt(String(param.nodeId)))
        if (node) {
          computeAndRegisterSlots(node)
        }
      }
      if (origTrigger) {
        origTrigger.call(graph, action, param)
      }
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
    restoreHandlers = () => {
      graph.onNodeAdded = origNodeAdded || undefined
      graph.onNodeRemoved = origNodeRemoved || undefined
      graph.onTrigger = origTrigger || undefined
      graph.onAfterChange = origAfterChange || undefined
    }
  }

  /**
   * Stop slot layout sync and cleanup all subscriptions
   */
  function stop(): void {
    if (unsubscribeLayoutChange) {
      unsubscribeLayoutChange()
      unsubscribeLayoutChange = null
    }
    if (restoreHandlers) {
      restoreHandlers()
      restoreHandlers = null
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop
  }
}
