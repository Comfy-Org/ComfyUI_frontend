import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { compareNodeIds } from '@/types/nodeId'

const RENDER_ONLY_KEYS = new Set(['boundingRect'])

/**
 * Safety net against unbounded or cyclic structures reaching the
 * serializer (e.g. runtime objects leaking into semantic state). Semantic
 * graph payloads are shallow; anything deeper indicates a bug upstream.
 */
const MAX_CANONICALIZE_DEPTH = 32

function canonicalize(value: unknown, depth = 0): unknown {
  if (depth > MAX_CANONICALIZE_DEPTH) {
    throw new Error(
      `serializeDocumentScope: exceeded max canonicalization depth of ${MAX_CANONICALIZE_DEPTH}; semantic state likely contains a cycle or runtime-only object`
    )
  }
  if (Array.isArray(value))
    return value.map((entry) => canonicalize(entry, depth + 1))
  if (value instanceof Map || value instanceof Set) {
    return [...value]
      .map((entry) => canonicalize(entry, depth + 1))
      .sort((left, right) => {
        const leftBytes = JSON.stringify(left) ?? ''
        const rightBytes = JSON.stringify(right) ?? ''
        return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0
      })
  }
  if (typeof value === 'object' && value !== null) {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (RENDER_ONLY_KEYS.has(key)) continue
      const entry = canonicalize(source[key], depth + 1)
      if (entry !== undefined) result[key] = entry
    }
    return result
  }
  return value
}

/**
 * Explicit allowlist projection of a node slot to its semantic fields.
 * Slot objects carry runtime-only state that must never reach the
 * serializer: `_widget` (cyclic — widgets reference their node), `_data`,
 * `hasErrors`, `boundingRect`, and the deprecated link-store-derived
 * `link`/`links` getters.
 */
function pickSlot(slot: INodeInputSlot | INodeOutputSlot) {
  const input = slot as Partial<INodeInputSlot>
  const output = slot as Partial<INodeOutputSlot>
  return {
    name: slot.name,
    localized_name: slot.localized_name,
    label: slot.label,
    type: slot.type,
    dir: slot.dir,
    removable: slot.removable,
    shape: slot.shape,
    color_off: slot.color_off,
    color_on: slot.color_on,
    locked: slot.locked,
    nameLocked: slot.nameLocked,
    pos: slot.pos,
    widget: input.widget
      ? { name: input.widget.name, type: input.widget.type }
      : undefined,
    widgetId: input.widgetId,
    alwaysVisible: input.alwaysVisible,
    slot_index: output.slot_index
  }
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
    .map(({ graphId: _graphId, lastSerialization: _cache, ...semantic }) => ({
      ...semantic,
      inputs: semantic.inputs.map(pickSlot),
      outputs: semantic.outputs.map(pickSlot),
      widgets: widgetStore
        .getNodeWidgets(scope.rootGraphId, semantic.id)
        .map(({ name, type, value }) => ({ name, type, value }))
        // Code-unit comparison, not localeCompare: canonical bytes must not
        // depend on the host's locale.
        .sort((left, right) =>
          left.name < right.name ? -1 : left.name > right.name ? 1 : 0
        )
    }))

  const links = [...linkStore.graphTopologies(scope)]
    .sort((left, right) => left.id - right.id)
    .map(({ graphId: _graphId, ...topology }) => topology)

  return new TextEncoder().encode(
    JSON.stringify(canonicalize({ nodes, links }))
  )
}
