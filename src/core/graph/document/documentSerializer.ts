import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { compareNodeIds } from '@/types/nodeId'

const RENDER_ONLY_KEYS = new Set(['boundingRect'])

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value instanceof Map || value instanceof Set)
    return canonicalize([...value])
  if (typeof value === 'object' && value !== null) {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (RENDER_ONLY_KEYS.has(key)) continue
      const entry = canonicalize(source[key])
      if (entry !== undefined) result[key] = entry
    }
    return result
  }
  return value
}

/**
 * Renderer-independent canonical serialization of one document scope's
 * semantic ECS state (ADR-0024's persistence seam). Reads only the domain
 * stores — never the canvas, layout, or litegraph instances — so the same
 * document content produces the same bytes whether the document is active
 * on the canvas, activated under a different renderer, or never activated
 * at all. Byte equality of two serializations is the save/reload identity
 * check.
 */
export function serializeDocumentScope(scope: GraphScope): Uint8Array {
  const nodeStore = useNodeDataStore()
  const linkStore = useLinkStore()
  const widgetStore = useWidgetValueStore()

  const nodes = [
    ...nodeStore.getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
  ]
    .sort((left, right) => compareNodeIds(left.id, right.id))
    .map(
      ({
        graphId: _graphId,
        lastSerialization: _cache,
        nodeIncarnation,
        ...semantic
      }) => ({
        ...semantic,
        ...(nodeIncarnation !== undefined && {
          node_incarnation: nodeIncarnation
        }),
        widgets: widgetStore
          .getNodeWidgets(scope.rootGraphId, semantic.id)
          .map(({ name, type, value }) => ({ name, type, value }))
          .sort((left, right) =>
            left.name < right.name ? -1 : left.name > right.name ? 1 : 0
          )
      })
    )

  const links = [...linkStore.graphTopologies(scope)]
    .sort((left, right) => left.id - right.id)
    .map(({ graphId: _graphId, ...topology }) => topology)

  return new TextEncoder().encode(
    JSON.stringify(canonicalize({ nodes, links }))
  )
}
