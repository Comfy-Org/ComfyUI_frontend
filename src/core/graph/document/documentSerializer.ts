import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { assert } from '@/base/assert'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { compareNodeIds } from '@/types/nodeId'

const RENDER_ONLY_KEYS = new Set(['boundingRect'])
const MAX_DEPTH_ERROR =
  'serializeDocumentScope: exceeded max canonicalization depth; semantic state likely contains a cycle or runtime-only object'

/**
 * Safety net against unbounded or cyclic structures reaching the
 * serializer (e.g. runtime objects leaking into semantic state). Semantic
 * graph payloads are shallow; anything deeper indicates a bug upstream.
 */
const MAX_CANONICALIZE_DEPTH = 32

function canonicalize(value: unknown, depth = 0): unknown {
  if (depth > MAX_CANONICALIZE_DEPTH) {
    assert(false, MAX_DEPTH_ERROR)
    throw new TypeError(MAX_DEPTH_ERROR)
  }
  if (Array.isArray(value))
    return value.map((entry) => canonicalize(entry, depth + 1))
  if (value instanceof Map || value instanceof Set)
    return canonicalize([...value], depth + 1)
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      if (RENDER_ONLY_KEYS.has(key)) continue
      const sourceValue: unknown = Reflect.get(value, key)
      const entry = canonicalize(sourceValue, depth + 1)
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
function pickCommonSlot(slot: INodeInputSlot | INodeOutputSlot) {
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
    pos: slot.pos
  }
}

function pickInputSlot(slot: INodeInputSlot) {
  return {
    ...pickCommonSlot(slot),
    widget: slot.widget
      ? { name: slot.widget.name, type: slot.widget.type }
      : undefined,
    widgetId: slot.widgetId,
    alwaysVisible: slot.alwaysVisible
  }
}

function pickOutputSlot(slot: INodeOutputSlot) {
  return {
    ...pickCommonSlot(slot),
    slot_index: slot.slot_index
  }
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
      inputs: semantic.inputs.map(pickInputSlot),
      outputs: semantic.outputs.map(pickOutputSlot),
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
