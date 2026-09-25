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
 * Per-node bookkeeping the op layer's applier stamps on every node record
 * (`NODE_INCARNATION_KEY`, not exported by the package). Its own `project()`
 * drops it; so does this reader.
 */
const NODE_INCARNATION = '__incarnation'

/** The op layer reserves double-underscore definition keys for bookkeeping. */
function isDefinitionBookkeeping(key: string): boolean {
  return key.startsWith('__')
}

/**
 * Own-key filter shared by both record readers. Assigning through
 * `record['__proto__']` swaps the record's prototype, so a document carrying
 * that key would hand LiteGraph an object whose inherited keys it never wrote.
 */
function isReadableKey(key: string): boolean {
  return key !== '__proto__'
}

function withoutUnsafeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUnsafeKeys)
  if (typeof value !== 'object' || value === null) return value
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      isReadableKey(key) ? [[key, withoutUnsafeKeys(nested)]] : []
    )
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
    return withoutUnsafeKeys(value.toJSON())
  }
  return withoutUnsafeKeys(structuredClone(value))
}

function withoutDefinitionBookkeeping(source: unknown): unknown {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return source
  }
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, value]) => {
      if (isDefinitionBookkeeping(key)) return []
      if (key !== 'definitions') return [[key, value]]
      return [[key, withoutNestedDefinitionBookkeeping(value)]]
    })
  )
}

function withoutNestedDefinitionBookkeeping(source: unknown): unknown {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return source
  }
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      key === 'subgraphs' && Array.isArray(value)
        ? value.map(withoutDefinitionBookkeeping)
        : value
    ])
  )
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
    if (key === NODE_INCARNATION || !isReadableKey(key)) return
    if (key === 'widgets' && value instanceof Y.Map) {
      node.widgets_values_named = Object.fromEntries(
        [...value.entries()].flatMap(([name, widgetValue]) =>
          isReadableKey(name) ? [[name, plain(widgetValue)]] : []
        )
      )
    } else if (key === OPAQUE_WIDGETS_KEY) {
      node.widgets_values = plain(value)
    } else {
      node[key] = plain(value)
    }
  })
  return node
}

function isSkippedDefinitionKey(key: string): boolean {
  return (
    key === NODE_ORDER ||
    key === LINK_ORDER ||
    isDefinitionBookkeeping(key) ||
    !isReadableKey(key)
  )
}

function projectDefinitionNodes(
  source: Y.Map<unknown>,
  nodes: Y.Map<unknown>
): Record<string, unknown>[] {
  return orderedKeys(source.get(NODE_ORDER), nodes).flatMap((id) => {
    const node = readInteriorNode(nodes.get(id))
    return node ? [node] : []
  })
}

function projectDefinitionLinks(
  source: Y.Map<unknown>,
  links: Y.Map<unknown>
): unknown[] {
  return orderedKeys(source.get(LINK_ORDER), links).map((id) =>
    plain(links.get(id))
  )
}

function projectDefinitionEntry(
  source: Y.Map<unknown>,
  key: string,
  value: unknown,
  excludedDefinitionIds: ReadonlySet<string>
): Array<[string, unknown]> {
  if (isSkippedDefinitionKey(key)) return []
  if (key === 'nodes' && value instanceof Y.Map) {
    return [[key, projectDefinitionNodes(source, value)]]
  }
  if (key === 'links' && value instanceof Y.Map) {
    return [[key, projectDefinitionLinks(source, value)]]
  }
  if (key === 'definitions') {
    if (value instanceof Y.Map) {
      return [[key, readNestedDefinitions(value, excludedDefinitionIds)]]
    }
    return [[key, withoutNestedDefinitionBookkeeping(plain(value))]]
  }
  return [[key, plain(value)]]
}

function projectSubgraphDefinition(
  source: Y.Map<unknown>,
  excludedDefinitionIds: ReadonlySet<string>
): ExportedSubgraph {
  const definition = Object.fromEntries(
    [...source.entries()].flatMap(([key, value]) =>
      projectDefinitionEntry(source, key, value, excludedDefinitionIds)
    )
  )
  return definition as unknown as ExportedSubgraph
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasSafeInputs(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (input) =>
          isRecord(input) &&
          typeof input.name === 'string' &&
          (input.linkIds === undefined || Array.isArray(input.linkIds))
      ))
  )
}

function hasSafeNodes(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (node) =>
          isRecord(node) &&
          (node.inputs === undefined ||
            (Array.isArray(node.inputs) && node.inputs.every(isRecord)))
      ))
  )
}

function hasSafeLinks(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isRecord))
}

function hasSafeNestedDefinitions(value: unknown): boolean {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  const nested = value.subgraphs
  return (
    nested === undefined ||
    (Array.isArray(nested) && nested.every(isSafeDefinition))
  )
}

function isSafeDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasSafeInputs(value.inputs) &&
    hasSafeNodes(value.nodes) &&
    hasSafeLinks(value.links) &&
    hasSafeNestedDefinitions(value.definitions)
  )
}

function isExcludedDefinition(
  source: Y.Map<unknown>,
  excludedDefinitionIds: ReadonlySet<string>
): boolean {
  const id = plain(source.get('id'))
  return typeof id === 'string' && excludedDefinitionIds.has(id)
}

function readNestedDefinitions(
  source: Y.Map<unknown>,
  excludedDefinitionIds: ReadonlySet<string>
): Record<string, unknown> {
  const definitions: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === 'subgraph_order' || !isReadableKey(key)) return
    if (key === 'subgraphs' && value instanceof Y.Map) {
      definitions.subgraphs = orderedKeys(
        source.get('subgraph_order'),
        value
      ).flatMap((id) => {
        const definition = value.get(id)
        if (
          definition instanceof Y.Map &&
          isExcludedDefinition(definition, excludedDefinitionIds)
        ) {
          return []
        }
        return [
          definition instanceof Y.Map
            ? readDefinition(definition, excludedDefinitionIds)
            : null
        ]
      })
    } else {
      definitions[key] = plain(value)
    }
  })
  return definitions
}

function readDefinition(
  source: Y.Map<unknown>,
  excludedDefinitionIds: ReadonlySet<string>
): ExportedSubgraph | null {
  const definition = projectSubgraphDefinition(source, excludedDefinitionIds)
  return isSafeDefinition(definition) ? definition : null
}

function readField(source: unknown, key: string): unknown {
  if (source instanceof Y.Map) return source.get(key)
  if (
    typeof source !== 'object' ||
    source === null ||
    !isReadableKey(key) ||
    !Object.hasOwn(source, key)
  ) {
    return undefined
  }
  return Reflect.get(source, key)
}

function readList(source: unknown): unknown[] {
  if (source instanceof Y.Array) return source.toArray()
  return Array.isArray(source) ? source : []
}

function collectDefinitionIds(source: unknown, ids: string[]): void {
  const pending = [source]
  while (pending.length > 0) {
    const definition = pending.pop()
    const id = plain(readField(definition, 'id'))
    if (typeof id === 'string') ids.push(id)
    const container = readField(definition, 'definitions')
    const nested = readField(container, 'subgraphs')
    const definitions =
      nested instanceof Y.Map
        ? orderedKeys(readField(container, 'subgraph_order'), nested).map(
            (key) => nested.get(key)
          )
        : readList(nested)
    for (let index = definitions.length - 1; index >= 0; index--) {
      pending.push(definitions[index])
    }
  }
}

function definitionsMap(doc: Y.Doc): Y.Map<unknown> | null {
  const root = doc.share.get(DEFINITIONS_ROOT)
  if (!root) return null
  if (root instanceof Y.Map) return root
  if (root.constructor !== Y.AbstractType) return null
  return doc.getMap<unknown>(DEFINITIONS_ROOT)
}

export function allSubgraphDefinitions(
  definitions: readonly ExportedSubgraph[]
): ExportedSubgraph[] {
  return [
    ...definitions,
    ...definitions.flatMap((definition) =>
      allSubgraphDefinitions(definition.definitions?.subgraphs ?? [])
    )
  ]
}

export function readSubgraphDefinitionIds(doc: Y.Doc): string[] {
  const ids: string[] = []
  const root = definitionsMap(doc)
  if (!root) return ids
  root.forEach((value) => {
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
 * Excluded IDs are checked before projection so their bodies are not copied.
 */
export function readSubgraphDefinitions(
  doc: Y.Doc,
  excludedDefinitionIds: ReadonlySet<string> = new Set()
): ExportedSubgraph[] {
  const definitions: ExportedSubgraph[] = []
  const root = definitionsMap(doc)
  if (!root) return definitions
  root.forEach((value) => {
    if (!(value instanceof Y.Map)) return
    if (isExcludedDefinition(value, excludedDefinitionIds)) return
    const definition = readDefinition(value, excludedDefinitionIds)
    if (definition) definitions.push(definition)
  })
  return definitions
}
