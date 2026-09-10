import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { compareNodeIds } from '@/types/nodeId'

const RENDER_ONLY_KEYS = new Set(['boundingRect'])

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortBySerializedForm(entries: readonly unknown[]): unknown[] {
  return entries
    .map((entry) => [JSON.stringify(entry), entry] as const)
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([, entry]) => entry)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  // Iteration order of a Map or a Set is insertion order, which differs
  // between the full-snapshot rebuild path and the live incremental path.
  if (value instanceof Map)
    return sortBySerializedForm(
      [...value].map(([key, entry]) => [canonicalize(key), canonicalize(entry)])
    )
  if (value instanceof Set)
    return sortBySerializedForm([...value].map(canonicalize))
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
 * semantic ECS state (ADR-GRAPH-DOCUMENT-0024's persistence seam). Reads only the domain
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
    .map(({ graphId: _graphId, lastSerialization: _cache, ...semantic }) => ({
      ...semantic,
      widgets: widgetStore
        .getNodeWidgets(scope.rootGraphId, semantic.id)
        .map(({ name, type, value }) => ({ name, type, value }))
        .sort((left, right) => compareCodeUnits(left.name, right.name))
    }))

  const links = [...linkStore.graphTopologies(scope)]
    .sort((left, right) => left.id - right.id)
    .map(({ graphId: _graphId, ...topology }) => topology)

  return new TextEncoder().encode(
    JSON.stringify(canonicalize({ nodes, links }))
  )
}
