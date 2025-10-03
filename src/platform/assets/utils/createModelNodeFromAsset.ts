import {
  type LGraphNode,
  LiteGraph,
  type Point
} from '@/lib/litegraph/src/litegraph'
import {
  type AssetItem,
  assetItemSchema
} from '@/platform/assets/schemas/assetSchema'
import {
  MISSING_TAG,
  MODELS_TAG
} from '@/platform/assets/services/assetService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface CreateNodeOptions {
  position?: Point
}

export function createModelNodeFromAsset(
  asset: AssetItem,
  options?: CreateNodeOptions
): LGraphNode {
  const validatedAsset = assetItemSchema.safeParse(asset)

  if (!validatedAsset.success) {
    throw new Error(
      `Invalid asset item: ${validatedAsset.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    )
  }

  const validAsset = validatedAsset.data

  const userMetadata = validAsset.user_metadata
  if (!userMetadata) {
    throw new Error(`Asset ${validAsset.id} missing required user_metadata`)
  }

  const filename = userMetadata.filename
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error(
      `Asset ${validAsset.id} has invalid user_metadata.filename (expected non-empty string, got ${typeof filename})`
    )
  }

  if (validAsset.tags.length === 0) {
    throw new Error(
      `Asset ${validAsset.id} has no tags defined (expected at least one category tag)`
    )
  }

  const category = validAsset.tags.find(
    (tag) => tag !== MODELS_TAG && tag !== MISSING_TAG
  )
  if (!category) {
    throw new Error(
      `Asset ${validAsset.id} has no valid category tag. Available tags: ${validAsset.tags.join(', ')} (expected tag other than '${MODELS_TAG}' or '${MISSING_TAG}')`
    )
  }

  // 3. Get node provider for category
  const modelToNodeStore = useModelToNodeStore()
  const provider = modelToNodeStore.getNodeProvider(category)
  if (!provider) {
    throw new Error(`No node provider registered for category: ${category}`)
  }

  // 4. Get position (default to canvas center)
  const litegraphService = useLitegraphService()
  const pos = options?.position ?? litegraphService.getCanvasCenter()

  // 5. Create node
  const node = LiteGraph.createNode(
    provider.nodeDef.name,
    provider.nodeDef.display_name,
    { pos }
  )

  if (!node) {
    throw new Error(`Failed to create node for type: ${provider.nodeDef.name}`)
  }

  // 6. Add node to appropriate graph
  const workflowStore = useWorkflowStore()
  const targetGraph = workflowStore.isSubgraphActive
    ? workflowStore.activeSubgraph
    : app.canvas.graph

  if (!targetGraph) {
    throw new Error('No active graph available')
  }

  targetGraph.add(node)

  // 7. Set widget value
  const widget = node.widgets?.find((w) => w.name === provider.key)
  if (!widget) {
    console.warn(
      `Widget ${provider.key} not found on node ${provider.nodeDef.name}`
    )
  } else {
    widget.value = filename
  }

  return node
}
