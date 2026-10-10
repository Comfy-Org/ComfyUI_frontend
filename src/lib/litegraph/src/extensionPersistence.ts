import { isProxy } from 'vue'

import type {
  ExportedSubgraph,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph
} from './types/serialisation'

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

type ExtensionPayload = Record<string, JsonValue>

interface ExtensionState {
  legacy: ExtensionPayload
  namespaced: ExtensionPayload
}

const payloads = new WeakMap<object, ExtensionState>()

function safeCloneExtensionValue(value: unknown): JsonValue | undefined {
  let clonedValue: unknown
  try {
    clonedValue = structuredClone(value)
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'DataCloneError')
      throw error
    try {
      clonedValue = JSON.parse(JSON.stringify(value))
    } catch {
      return
    }
  }

  return isJsonValue(clonedValue) ? clonedValue : undefined
}

function isIndexedArrayLike(value: object): value is ArrayLike<unknown> {
  if (Array.isArray(value)) return false
  const length: unknown = Reflect.get(value, 'length')
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0)
    return false
  return Object.keys(value).every((key) => {
    const index = Number(key)
    return Number.isInteger(index) && index >= 0 && index < length
  })
}

function containsVueProxy(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return false
  if (isProxy(value)) return true
  if (seen.has(value)) return false
  seen.add(value)
  return Object.values(value).some((child) => containsVueProxy(child, seen))
}

function detachCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  try {
    return structuredClone(value)
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'DataCloneError')
      throw error
  }
  // Live geometry views (`pos`, `size`) are non-Vue proxies over typed arrays;
  // JSON would turn them into `{ "0": x, "1": y }` instead of `[x, y]`.
  if (isIndexedArrayLike(value))
    return Array.from({ length: value.length }, (_, index) =>
      detachCanonicalValue(value[index])
    )
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function readClonedEntry(source: object, key: string): JsonValue | undefined {
  try {
    return safeCloneExtensionValue(Reflect.get(source, key))
  } catch {
    return undefined
  }
}

const nodeCanonicalFields = {
  title: true,
  id: true,
  type: true,
  pos: true,
  size: true,
  flags: true,
  order: true,
  mode: true,
  outputs: true,
  inputs: true,
  properties: true,
  shape: true,
  boxcolor: true,
  color: true,
  bgcolor: true,
  showAdvanced: true,
  widgets_values: true,
  widgets_values_named: true
} satisfies Record<Exclude<keyof ISerialisedNode, 'extensions'>, true>

export type NodeCanonicalField = keyof typeof nodeCanonicalFields

export const NODE_CANONICAL_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(nodeCanonicalFields)
)

export function isNodeCanonicalField(key: string): key is NodeCanonicalField {
  return NODE_CANONICAL_FIELDS.has(key)
}

export type GraphCanonicalField = Exclude<
  keyof SerialisableGraph | keyof ExportedSubgraph | keyof ISerialisedGraph,
  'extensions'
>

const graphCanonicalFields = {
  id: true,
  revision: true,
  config: true,
  subgraphs: true,
  definitions: true,
  version: true,
  state: true,
  last_node_id: true,
  last_link_id: true,
  groups: true,
  nodes: true,
  links: true,
  floatingLinks: true,
  reroutes: true,
  extra: true,
  name: true,
  category: true,
  description: true,
  inputNode: true,
  outputNode: true,
  inputs: true,
  outputs: true,
  widgets: true
} satisfies Record<GraphCanonicalField, true>

export const GRAPH_CANONICAL_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(graphCanonicalFields)
)

export function isGraphCanonicalField(key: string): key is GraphCanonicalField {
  return GRAPH_CANONICAL_FIELDS.has(key)
}

const isJsonValue = (
  value: unknown,
  ancestors = new WeakSet<object>()
): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (ancestors.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    return false

  ancestors.add(value)
  const isJson = Object.values(value).every((entry) =>
    isJsonValue(entry, ancestors)
  )
  ancestors.delete(value)
  return isJson
}

const isSafeExtensionKey = (key: string): boolean => key !== '__proto__'

const readPayload = (value: unknown): ExtensionPayload => {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    console.warn('LiteGraph: ignoring non-serializable extension payload')
    return {}
  }
  let keys: string[]
  try {
    keys = Object.keys(value)
  } catch {
    console.warn('LiteGraph: ignoring non-serializable extension payload')
    return {}
  }
  const payload: ExtensionPayload = {}
  for (const key of keys) {
    if (!isSafeExtensionKey(key)) continue
    const clonedEntry = readClonedEntry(value, key)
    if (clonedEntry !== undefined) {
      payload[key] = clonedEntry
    } else {
      console.warn('LiteGraph: ignoring non-serializable extension payload')
    }
  }
  return payload
}

function readNamespacedPayload(source: object): ExtensionPayload {
  try {
    return readPayload(Reflect.get(source, 'extensions'))
  } catch {
    console.warn('LiteGraph: ignoring non-serializable extension payload')
    return {}
  }
}

function readExtensionFields(
  source: object,
  canonicalFields: ReadonlySet<string>
): ExtensionPayload {
  const payload: ExtensionPayload = {}
  for (const key of Object.keys(source)) {
    if (
      !isSafeExtensionKey(key) ||
      canonicalFields.has(key) ||
      key === 'extensions'
    ) {
      continue
    }
    const clonedValue = readClonedEntry(source, key)
    if (clonedValue !== undefined) {
      payload[key] = clonedValue
    } else {
      console.warn('LiteGraph: ignoring non-serializable extension payload')
    }
  }
  return payload
}

export const hydrateExtensionPayload = (
  owner: object,
  data: object,
  canonicalFields: ReadonlySet<string>
): void => {
  const previous = payloads.get(owner)
  for (const key of Object.keys(previous?.legacy ?? {}))
    Reflect.deleteProperty(owner, key)

  const namespaced = readNamespacedPayload(data)
  const legacyFields = readExtensionFields(data, canonicalFields)
  Object.assign(owner, structuredClone(legacyFields))
  for (const key of Object.keys(legacyFields)) delete namespaced[key]
  payloads.set(owner, { legacy: legacyFields, namespaced })
}

export const runExtensionSerializeHook = <T extends object>(
  owner: object,
  canonical: T,
  canonicalFields: ReadonlySet<string>,
  hook?: (data: T) => unknown
): T => {
  const state = payloads.get(owner) ?? { legacy: {}, namespaced: {} }
  if (
    !hook &&
    Object.keys(state.legacy).length === 0 &&
    Object.keys(state.namespaced).length === 0
  )
    return canonical

  const view = canonical
  const before = new Map(
    [...canonicalFields].map((key) => [key, Reflect.get(view, key)])
  )
  Object.assign(view, structuredClone(state.legacy), {
    extensions: structuredClone({ ...state.namespaced, ...state.legacy })
  })
  hook?.(view)

  for (const key of canonicalFields) {
    if (Object.hasOwn(view, key)) {
      const value: unknown = Reflect.get(view, key)
      // A hook that hands back live state (e.g. `o.properties = this.properties`,
      // a reactive proxy since node state moved into the store), whole or
      // nested, must not leak into serialized output: structuredClone of that
      // output would throw.
      Reflect.set(
        canonical,
        key,
        value !== before.get(key) || (hook && containsVueProxy(value))
          ? detachCanonicalValue(value)
          : value
      )
    } else {
      Reflect.deleteProperty(canonical, key)
    }
  }

  const namespaced = readNamespacedPayload(view)
  const legacy = readExtensionFields(view, canonicalFields)
  for (const key of Object.keys(legacy)) delete namespaced[key]
  payloads.set(owner, { legacy, namespaced })

  const extensions = { ...namespaced, ...legacy }
  if (Object.keys(extensions).length)
    return Object.assign(canonical, {
      extensions: structuredClone(extensions)
    })
  Reflect.deleteProperty(canonical, 'extensions')
  return canonical
}

export const extensionConfigureView = <T extends object>(
  owner: object,
  canonical: T
): T =>
  Object.assign(
    { ...canonical },
    structuredClone(payloads.get(owner)?.namespaced),
    structuredClone(payloads.get(owner)?.legacy)
  )
