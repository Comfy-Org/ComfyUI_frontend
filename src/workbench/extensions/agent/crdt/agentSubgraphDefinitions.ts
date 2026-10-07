import { OPAQUE_WIDGETS_KEY, nodesMap } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
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

const MAX_PROJECTED_VALUE_DEPTH = 100
const MAX_PROJECTED_VALUE_NODES = 100_000
const PROJECTION_BUDGET_EXCEEDED = Symbol('projection-budget-exceeded')

function withoutUnsafeKeys(
  value: unknown,
  budget = { remaining: MAX_PROJECTED_VALUE_NODES },
  depth = 0
): unknown {
  if (depth > MAX_PROJECTED_VALUE_DEPTH || --budget.remaining < 0) {
    throw PROJECTION_BUDGET_EXCEEDED
  }
  if (Array.isArray(value))
    return value.map((nested) => withoutUnsafeKeys(nested, budget, depth + 1))
  if (typeof value !== 'object' || value === null) return value
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      isReadableKey(key)
        ? [[key, withoutUnsafeKeys(nested, budget, depth + 1)]]
        : []
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
  try {
    const definition = projectSubgraphDefinition(source, excludedDefinitionIds)
    return isSafeDefinition(definition) ? definition : null
  } catch {
    return null
  }
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

type StoredDefinition = readonly [string, Y.Map<unknown>]

function storedDefinitions(source: Y.Map<unknown>): StoredDefinition[] {
  return [...source.entries()].flatMap(([key, value]) =>
    value instanceof Y.Map ? [[key, value] as const] : []
  )
}

function nestedStoredDefinitions(
  definition: Y.Map<unknown>
): StoredDefinition[] {
  const container = definition.get('definitions')
  if (!(container instanceof Y.Map)) return []
  const nested = container.get('subgraphs')
  return nested instanceof Y.Map ? storedDefinitions(nested) : []
}

/** Resolve one definition at any nesting depth; duplicate ids are unreadable. */
function definitionById(doc: Y.Doc, id: string): Y.Map<unknown> | null {
  const root = definitionsMap(doc)
  if (!root) return null
  const pending = storedDefinitions(root)
  const seen = new Set<Y.Map<unknown>>()
  let match: Y.Map<unknown> | null = null
  while (pending.length > 0) {
    const [storageKey, definition] = pending.pop()!
    if (seen.has(definition)) continue
    seen.add(definition)
    if (storageKey === id || definition.get('id') === id) {
      if (match !== null) return null
      match = definition
    }
    pending.push(...nestedStoredDefinitions(definition))
  }
  return match
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

/**
 * What the document knows about a node's promoted widget layout.
 *
 * `valueCount` sizes the positional array a promoted write indexes.
 * `promotedNames` reconstructs that array's exact name order from definition
 * links that target widget-backed interior inputs. The instance input mirror
 * is not authoritative: shipped workflows can mirror promoted inputs without
 * a `widget` marker. An absent or unreadable definition is represented by
 * null so the minter fails closed.
 */
export interface DocPromotedWidgets {
  valueCount: number | null
  declaredNames: readonly string[]
  promotedNames: readonly string[] | null
}

/** Null when the document holds no such node. */
export function readDocPromotedWidgets(
  doc: Y.Doc,
  nodeId: string
): DocPromotedWidgets | null {
  const nodes = nodesMap(doc)
  if (!nodes.has(nodeId)) return null
  const node = nodes.get(nodeId)
  if (!(node instanceof Y.Map)) {
    return { valueCount: null, declaredNames: [], promotedNames: null }
  }
  // A promoted subgraph host is positional-only. The applier deliberately
  // converts the empty named map minted for `widgets_values: []`, but a
  // populated or malformed named store cannot be converted: adding opaque
  // storage beside it would make the node ambiguous for every reader.
  if (node.has('widgets')) {
    const named = node.get('widgets')
    if (
      node.has(OPAQUE_WIDGETS_KEY) ||
      !(named instanceof Y.Map) ||
      named.size > 0
    ) {
      return { valueCount: null, declaredNames: [], promotedNames: null }
    }
  }
  const stored = node.get(OPAQUE_WIDGETS_KEY)
  const type = node.get('type')
  const definition = typeof type === 'string' ? definitionById(doc, type) : null
  const names =
    definition instanceof Y.Map ? definitionPromotedLayout(definition) : null
  return {
    valueCount:
      stored === undefined
        ? 0
        : stored instanceof Y.Array || Array.isArray(stored)
          ? stored.length
          : null,
    declaredNames: names?.declared ?? [],
    promotedNames: names?.promoted ?? null
  }
}

function namedInputs(source: unknown): Array<[string, unknown]> | null {
  const inputs =
    source instanceof Y.Array
      ? source.toArray()
      : Array.isArray(source)
        ? source
        : null
  if (inputs === null) return null
  const named: Array<[string, unknown]> = []
  const seen = new Set<string>()
  for (const input of inputs) {
    const name = readField(input, 'name')
    if (typeof name !== 'string' || seen.has(name)) return null
    seen.add(name)
    named.push([name, input])
  }
  return named
}

function strictList(source: unknown): unknown[] | null {
  if (source instanceof Y.Array) return source.toArray()
  return Array.isArray(source) ? source : null
}

type StoredRecordLookup = (id: string | number) => unknown

/** Build one lookup per definition read so array-backed peer data stays O(n). */
function storedRecordLookup(source: unknown): StoredRecordLookup | null {
  if (source instanceof Y.Map) return (id) => source.get(String(id))
  const records = strictList(source)
  if (records === null) return null
  const byId = new Map<string, unknown>()
  for (const record of records) {
    const id = readField(record, 'id')
    if (!isRecordId(id) || byId.has(String(id))) return null
    byId.set(String(id), record)
  }
  return (id) => byId.get(String(id))
}

function linkTargetsWidget(
  links: StoredRecordLookup,
  nodes: StoredRecordLookup,
  linkId: string | number
): boolean | null {
  const link = links(linkId)
  if (link === undefined) return null
  const targetId = readField(link, 'target_id')
  const targetSlot = readField(link, 'target_slot')
  if (!isRecordId(targetId) || !isSlotIndex(targetSlot)) return null
  // A subgraph input may legally pass straight through to the synthetic
  // output node. That endpoint has no definition node record and is not a
  // promoted widget target.
  if (String(targetId) === String(SUBGRAPH_OUTPUT_ID)) return false
  const target = nodes(targetId)
  if (target === undefined) return null
  const inputs = strictList(readField(target, 'inputs'))
  const input = inputs?.[targetSlot]
  if (input === undefined) return null
  const widget = readField(input, 'widget')
  return widgetMarkerState(widget)
}

function isRecordId(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function isSlotIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function widgetMarkerState(widget: unknown): boolean | null {
  if (widget === undefined || widget === null) return false
  return typeof readField(widget, 'name') === 'string' ? true : null
}

function inputTargetsWidget(
  links: StoredRecordLookup,
  nodes: StoredRecordLookup,
  input: unknown
): boolean | null {
  const storedLinkIds = readField(input, 'linkIds')
  if (storedLinkIds === undefined) return false
  const linkIds = strictList(storedLinkIds)
  if (linkIds === null || !linkIds.every(isRecordId)) return null
  let widgetBacked = false
  for (const linkId of linkIds) {
    const targetsWidget = linkTargetsWidget(links, nodes, linkId)
    if (targetsWidget === null) return null
    widgetBacked ||= targetsWidget
  }
  return widgetBacked
}

export interface DefinitionPromotedLayout {
  declared: string[]
  promoted: string[]
}

export function definitionPromotedLayout(
  definition: unknown
): DefinitionPromotedLayout | null {
  const declared = namedInputs(readField(definition, 'inputs'))
  const links = storedRecordLookup(readField(definition, 'links'))
  const nodes = storedRecordLookup(readField(definition, 'nodes'))
  if (declared === null || links === null || nodes === null) return null
  const promoted: string[] = []
  for (const [name, input] of declared) {
    const targetsWidget = inputTargetsWidget(links, nodes, input)
    if (targetsWidget === null) return null
    if (targetsWidget) promoted.push(name)
  }
  return { declared: declared.map(([name]) => name), promoted }
}

/** The document value behind a promoted host register, when safely addressable. */
export function readDocPromotedWidgetValue(
  doc: Y.Doc,
  nodeId: string,
  widget: string
): unknown {
  const layout = readDocPromotedWidgets(doc, nodeId)
  const promotedNames = layout?.promotedNames
  if (
    layout === null ||
    promotedNames == null ||
    layout.valueCount !== promotedNames.length ||
    new Set(promotedNames).size !== promotedNames.length
  ) {
    return undefined
  }
  const index = promotedNames.indexOf(widget)
  if (index < 0) return undefined
  const stored = nodesMap(doc).get(nodeId)?.get(OPAQUE_WIDGETS_KEY)
  if (stored instanceof Y.Array) {
    return index < stored.length ? plain(stored.get(index)) : undefined
  }
  return Array.isArray(stored) ? plain(stored[index]) : undefined
}
