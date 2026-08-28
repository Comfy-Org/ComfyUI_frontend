type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

type ExtensionPayload = Record<string, JsonValue>

interface ExtensionState {
  legacy: ExtensionPayload
  namespaced: ExtensionPayload
}

const payloads = new WeakMap<object, ExtensionState>()

export const NODE_CANONICAL_FIELDS = new Set([
  'title',
  'id',
  'type',
  'pos',
  'size',
  'flags',
  'order',
  'mode',
  'outputs',
  'inputs',
  'properties',
  'shape',
  'boxcolor',
  'color',
  'bgcolor',
  'showAdvanced',
  'widgets_values',
  'widgets_values_named'
])

export const GRAPH_CANONICAL_FIELDS = new Set([
  'id',
  'revision',
  'config',
  'subgraphs',
  'definitions',
  'version',
  'state',
  'last_node_id',
  'last_link_id',
  'groups',
  'nodes',
  'links',
  'floatingLinks',
  'reroutes',
  'extra',
  'name',
  'category',
  'description',
  'inputNode',
  'outputNode',
  'inputs',
  'outputs',
  'widgets'
])

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
  if (
    !isJsonValue(value) ||
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    if (value !== undefined)
      console.warn('LiteGraph: ignoring non-serializable extension payload')
    return {}
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => isSafeExtensionKey(key))
      .map(([key, entry]) => [key, structuredClone(entry)])
  )
}

function copyExtensionFields(
  target: ExtensionPayload,
  source: Record<string, unknown>,
  canonicalFields: ReadonlySet<string>
): void {
  for (const [key, value] of Object.entries(source)) {
    if (
      !isSafeExtensionKey(key) ||
      canonicalFields.has(key) ||
      key === 'extensions' ||
      !isJsonValue(value)
    ) {
      if (
        isSafeExtensionKey(key) &&
        !canonicalFields.has(key) &&
        key !== 'extensions'
      )
        console.warn('LiteGraph: ignoring non-serializable extension payload')
      continue
    }
    target[key] = structuredClone(value)
  }
}

export const hydrateExtensionPayload = (
  owner: object,
  data: object,
  canonicalFields: ReadonlySet<string>
): void => {
  const record = Object.fromEntries(Object.entries(data))
  const previous = payloads.get(owner)
  for (const key of Object.keys(previous?.legacy ?? {}))
    Reflect.deleteProperty(owner, key)

  const namespaced = readPayload(record.extensions)
  const legacyFields: ExtensionPayload = {}
  copyExtensionFields(legacyFields, record, canonicalFields)
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
  Object.assign(view, structuredClone(state.legacy), {
    extensions: structuredClone({ ...state.namespaced, ...state.legacy })
  })
  hook?.(view)

  for (const key of canonicalFields) {
    if (Object.hasOwn(view, key)) {
      Reflect.set(canonical, key, Reflect.get(view, key))
    } else {
      Reflect.deleteProperty(canonical, key)
    }
  }

  const viewRecord = Object.fromEntries(Object.entries(view))
  const namespaced = readPayload(viewRecord.extensions)
  const legacy: ExtensionPayload = {}
  copyExtensionFields(legacy, viewRecord, canonicalFields)
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
    canonical,
    structuredClone(payloads.get(owner)?.namespaced),
    structuredClone(payloads.get(owner)?.legacy)
  )
