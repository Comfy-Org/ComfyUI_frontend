import type { LGraphNode, Point } from '@/lib/litegraph/src/litegraph'
import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import { createNodeFromModel } from '@/utils/nodeCreation/createNodeFromModel'

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
  const result = createNodeFromModel(
    model.directory,
    model.fileName,
    model.id,
    options
  )

  if (!result.success) {
    // Map generic error to model-specific error format
    return {
      success: false,
      error: {
        ...result.error,
        modelId: result.error.itemId
      } as NodeCreationError
    }
  }

  return result
}
