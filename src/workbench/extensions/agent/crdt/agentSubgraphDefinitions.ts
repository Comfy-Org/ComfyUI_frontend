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

/**
 * Private bookkeeping is never part of an exported definition. The prefix
 * filter also excludes `__proto__`, avoiding prototype mutation when records
 * are assembled through indexed assignment.
 */
function isPublicKey(key: string): boolean {
  return !key.startsWith('__')
}

function stripPrivateKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateKeys)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => isPublicKey(key))
      .map(([key, nested]) => [key, stripPrivateKeys(nested)])
  )
}

/**
 * A value slot's JSON view. Every shared type, and a subdocument, answers
 * `toJSON()`; `structuredClone` throws on all of them, and this reader runs
 * as a bare argument inside the follower's frame reconcile, where one throw
 * would stall every node on the canvas. The package only mints maps and
 * arrays; the rest arrive through a doc host folding in a raw update.
 */
function plain(value: unknown): unknown {
  if (value instanceof Y.AbstractType || value instanceof Y.Doc) {
    return stripPrivateKeys(value.toJSON())
  }
  return stripPrivateKeys(structuredClone(value))
}

/**
 * Register entries that name a record, first occurrence only, matching what
 * LiteGraph keeps when it normalizes a definition.
 */
function orderedKeys(register: unknown, map: Y.Map<unknown>): string[] {
  const order = Array.isArray(register)
    ? register.filter((key): key is string => typeof key === 'string')
    : [...map.keys()].sort()
  return [...new Set(order)].filter((key) => map.has(key))
}

/**
 * Interior node record → serialised node. Named widget values go to
 * `widgets_values_named`, the only name-keyed slot `LGraphNode.configure()`
 * reads; the opaque positional form stays `widgets_values`. A record whose
 * `widgets` is not a map cannot be read and is skipped, as the package's
 * `tryProjectNode()` skips it.
 */
function readInteriorNode(source: unknown): Record<string, unknown> | null {
  if (!(source instanceof Y.Map)) return null
  if (source.has('widgets') && !(source.get('widgets') instanceof Y.Map)) {
    return null
  }
  const node: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === OPAQUE_WIDGETS_KEY) {
      node.widgets_values = plain(value)
    } else if (!isPublicKey(key)) {
      return
    } else if (key === 'widgets' && value instanceof Y.Map) {
      node.widgets_values_named = plain(value)
    } else {
      node[key] = plain(value)
    }
  })
  return node
}

function readDefinition(source: Y.Map<unknown>): ExportedSubgraph {
  const definition: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === NODE_ORDER || key === LINK_ORDER || !isPublicKey(key)) return
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

function readField(source: unknown, key: string): unknown {
  if (source instanceof Y.Map) return source.get(key)
  if (typeof source !== 'object' || source === null || !(key in source)) {
    return undefined
  }
  return Reflect.get(source, key)
}

function readList(source: unknown): unknown[] {
  if (source instanceof Y.Array) return source.toArray()
  return Array.isArray(source) ? source : []
}

function collectDefinitionIds(source: unknown, ids: string[]): void {
  const id = readField(source, 'id')
  if (typeof id === 'string') ids.push(id)
  const nested = readField(readField(source, 'definitions'), 'subgraphs')
  for (const definition of readList(nested)) {
    collectDefinitionIds(definition, ids)
  }
}

export function readSubgraphDefinitionIds(doc: Y.Doc): string[] {
  const ids: string[] = []
  if (!doc.share.has(DEFINITIONS_ROOT)) return ids
  doc.getMap<unknown>(DEFINITIONS_ROOT).forEach((value) => {
    if (value instanceof Y.Map) collectDefinitionIds(value, ids)
  })
  return ids
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
  // `doc.getMap` defines the root when it is absent. A document that never
  // seeded definitions must keep its shape, so only read a root that exists.
  // (For a root that arrived over the wire, `getMap` upgrades the untyped
  // shared type in place; that is a read-side view, not new content.)
  if (!doc.share.has(DEFINITIONS_ROOT)) return definitions
  doc.getMap<unknown>(DEFINITIONS_ROOT).forEach((value) => {
    if (value instanceof Y.Map) definitions.push(readDefinition(value))
  })
  return definitions
}
