import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, Point } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'

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
  modelId: string
  details?: Record<string, unknown>
}

type Result<T, E> = { success: true; value: T } | { success: false; error: E }

/**
 * Creates a LiteGraph node from an enriched model.
 *
 * **Boundary Function**: Bridges Vue reactive domain with LiteGraph canvas domain.
 *
 * @param model - Enriched model to create node from (Vue domain)
 * @param options - Optional position and configuration
 * @returns Result with LiteGraph node (Canvas domain) or error details
 *
 * @remarks
 * This function performs side effects on the canvas graph. Validation failures
 * return error results rather than throwing to allow graceful degradation in UI contexts.
 * Widget validation occurs before graph mutation to prevent orphaned nodes.
 */
export function createModelNode(
  model: EnrichedModel,
  options?: CreateNodeOptions
): Result<LGraphNode, NodeCreationError> {
  const modelToNodeStore = useModelToNodeStore()
  const provider = modelToNodeStore.getNodeProvider(model.directory)

  if (!provider) {
    console.error(
      `No node provider registered for model type: ${model.directory}`
    )
    return {
      success: false,
      error: {
        code: 'NO_PROVIDER',
        message: `No node provider registered for model type: ${model.directory}`,
        modelId: model.id,
        details: { directory: model.directory }
      }
    }
  }

  const litegraphService = useLitegraphService()
  const pos = options?.position ?? litegraphService.getCanvasCenter()

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
        modelId: model.id,
        details: { nodeType: provider.nodeDef.name }
      }
    }
  }

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
        modelId: model.id
      }
    }
  }

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
        modelId: model.id,
        details: { widgetName: provider.key, nodeType: provider.nodeDef.name }
      }
    }
  }

  // Set widget value BEFORE adding to graph so the node is created with correct value
  widget.value = model.fileName

  // Now add the node to the graph with the correct widget value already set
  targetGraph.add(node)

  return { success: true, value: node }
}
