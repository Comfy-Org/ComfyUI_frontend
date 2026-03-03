import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ModelNodeProvider } from '@/stores/modelToNodeStore'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

export interface DetectedModel {
  /** Model filename as selected in the widget */
  name: string
  /** Model category from modelToNodeStore (e.g. 'checkpoints', 'loras') */
  category: string
  /** The loader node type that references this model */
  loaderNodeType: string
}

/**
 * Walks the graph and extracts all model references by matching loader nodes
 * against the registered model-to-node mappings.
 *
 * @param graph - The workflow graph to inspect
 * @param modelToNodeMap - The category-to-providers map from modelToNodeStore
 * @returns Deduplicated list of detected models
 */
export function detectModels(
  graph: LGraph | Subgraph | null | undefined,
  modelToNodeMap: Record<string, ModelNodeProvider[]>
): DetectedModel[] {
  if (!graph) return []

  // Build a reverse lookup: loaderNodeType -> { category, widgetKey }
  const loaderLookup = new Map<string, { category: string; key: string }>()
  for (const [category, providers] of Object.entries(modelToNodeMap)) {
    for (const provider of providers) {
      if (!provider.nodeDef?.name || !provider.key) continue
      loaderLookup.set(provider.nodeDef.name, {
        category,
        key: provider.key
      })
    }
  }

  const detected = mapAllNodes(graph, (node) => {
    const nodeType = node?.type
    if (!nodeType) return undefined

    const loader = loaderLookup.get(nodeType)
    if (!loader) return undefined

    // Read the model name from the node's widget values
    const widgetValue = node.widgets?.find(
      (widget) => widget.name === loader.key
    )?.value

    if (typeof widgetValue !== 'string' || !widgetValue) return undefined

    return {
      name: widgetValue,
      category: loader.category,
      loaderNodeType: nodeType
    } satisfies DetectedModel
  })

  // Deduplicate by name + category
  const seen = new Set<string>()
  return detected.filter((model) => {
    const key = `${model.category}:${model.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
