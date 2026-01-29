import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, Point } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface CreateNodeOptions {
  position?: Point
}

type NodeCreationErrorCode =
  | 'NO_PROVIDER'
  | 'NODE_CREATION_FAILED'
  | 'MISSING_WIDGET'
  | 'NO_GRAPH'

interface NodeCreationError {
  code: NodeCreationErrorCode
  message: string
  itemId: string
  details?: Record<string, unknown>
}

type Result<T, E> = { success: true; value: T } | { success: false; error: E }

/**
 * Core function to create a LiteGraph node from model metadata.
 *
 * **Boundary Function**: Bridges Vue reactive domain with LiteGraph canvas domain.
 *
 * @param category - Model category/directory (e.g., 'checkpoints', 'loras')
 * @param filename - Model filename to set in widget
 * @param itemId - Unique identifier for error reporting
 * @param options - Optional position and configuration
 * @returns Result with LiteGraph node (Canvas domain) or error details
 *
 * @remarks
 * This is a shared utility used by both local model browser and cloud asset browser.
 * Widget validation occurs before graph mutation to prevent orphaned nodes.
 */
export function createNodeFromModel(
  category: string,
  filename: string,
  itemId: string,
  options?: CreateNodeOptions
): Result<LGraphNode, NodeCreationError> {
  // 1. Get provider for model category
  const modelToNodeStore = useModelToNodeStore()
  const provider = modelToNodeStore.getNodeProvider(category)

  if (!provider) {
    console.error(`No node provider registered for category: ${category}`)
    return {
      success: false,
      error: {
        code: 'NO_PROVIDER',
        message: `No node provider registered for category: ${category}`,
        itemId,
        details: { category }
      }
    }
  }

  // 2. Determine position (use provided or canvas center)
  const litegraphService = useLitegraphService()
  const pos = options?.position ?? litegraphService.getCanvasCenter()

  // 3. Create node instance
  const node = LiteGraph.createNode(
    provider.nodeDef.name,
    provider.nodeDef.display_name,
    { pos }
  )

  if (!node) {
    console.error(`Failed to create node for type: ${provider.nodeDef.name}`)
    return {
      success: false,
      error: {
        code: 'NODE_CREATION_FAILED',
        message: `Failed to create node for type: ${provider.nodeDef.name}`,
        itemId,
        details: { nodeType: provider.nodeDef.name }
      }
    }
  }

  // 4. Determine target graph (subgraph or main graph)
  const workflowStore = useWorkflowStore()
  const targetGraph = workflowStore.isSubgraphActive
    ? workflowStore.activeSubgraph
    : app.canvas.graph

  if (!targetGraph) {
    console.error('No active graph available')
    return {
      success: false,
      error: {
        code: 'NO_GRAPH',
        message: 'No active graph available',
        itemId
      }
    }
  }

  // 5. Find and set widget value
  const widget = node.widgets?.find((w) => w.name === provider.key)
  if (!widget) {
    console.error(
      `Widget ${provider.key} not found on node ${provider.nodeDef.name}`
    )
    return {
      success: false,
      error: {
        code: 'MISSING_WIDGET',
        message: `Widget ${provider.key} not found on node ${provider.nodeDef.name}`,
        itemId,
        details: { widgetName: provider.key, nodeType: provider.nodeDef.name }
      }
    }
  }

  // Set widget value BEFORE adding to graph so the node is created with correct value
  widget.value = filename

  // 6. Add node to graph
  targetGraph.add(node)

  return { success: true, value: node }
}
