import { OPAQUE_WIDGETS_KEY } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'

/**
 * Root map the op layer mints `definitions.subgraphs` into, keyed by
 * definition id. `@comfyorg/comfy-multi-player` reads it through its private
 * `definitionsMap()`, which is not part of the package's public surface.
 */
const DEFINITIONS_ROOT = 'definitions'

/** Mint-order registers kept beside the interior `nodes`/`links` maps. */
const NODE_ORDER = 'node_order'
const LINK_ORDER = 'link_order'

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

function orderedKeys(register: unknown, map: Y.Map<unknown>): string[] {
  const order = Array.isArray(register)
    ? register.filter((key): key is string => typeof key === 'string')
    : [...map.keys()].sort()
  return order.filter((key) => map.has(key))
}

/**
 * Interior node record → serialised node. Named widget values go to
 * `widgets_values_named`, the only name-keyed slot `LGraphNode.configure()`
 * reads; the opaque positional form stays `widgets_values`.
 */
function readInteriorNode(source: unknown): Record<string, unknown> | null {
  if (!(source instanceof Y.Map)) return null
  const node: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === 'widgets' && value instanceof Y.Map) {
      node.widgets_values_named = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      node.widgets_values = plain(value)
    } else {
      node[key] = plain(value)
    }
  })
  return node
}

function readDefinition(source: Y.Map<unknown>): ExportedSubgraph {
  const definition: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === NODE_ORDER || key === LINK_ORDER) return
    if (key === 'nodes' && value instanceof Y.Map) {
      definition.nodes = orderedKeys(source.get(NODE_ORDER), value).flatMap(
        (id) => {
          const node = readInteriorNode(value.get(id))
          return node ? [node] : []
        }
      )
    } else if (key === 'links' && value instanceof Y.Map) {
      definition.links = orderedKeys(source.get(LINK_ORDER), value).map((id) =>
        plain(value.get(id))
      )
    } else {
      definition[key] = plain(value)
    }
  })
  return definition as unknown as ExportedSubgraph
}

/**
 * Project the subgraph definitions the op layer minted into the follower doc
 * back to the `ExportedSubgraph` shape `LGraph.createSubgraphs()` consumes,
 * interior nodes and links in mint order.
 *
 * Mirrors the package's own `projectDefinition()` so that what the agent
 * seeded and what the canvas instantiates agree byte-for-byte on structure.
 */
export function readSubgraphDefinitions(doc: Y.Doc): ExportedSubgraph[] {
  const definitions: ExportedSubgraph[] = []
  doc.getMap<unknown>(DEFINITIONS_ROOT).forEach((value) => {
    if (value instanceof Y.Map) definitions.push(readDefinition(value))
  })
  return definitions
}
