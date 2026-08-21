type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

type ExtensionPayload = Record<string, JsonValue>

const payloads = new WeakMap<object, ExtensionPayload>()

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

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== 'object') return false

  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every(isJsonValue)
  )
}

const readPayload = (value: unknown): ExtensionPayload => {
  if (
    !isJsonValue(value) ||
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return {}
  return structuredClone(value)
}

const cloneSerialisable = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

export const hydrateExtensionPayload = (
  owner: object,
  data: object,
  canonicalFields: ReadonlySet<string>
): void => {
  const record = Object.fromEntries(Object.entries(data))
  const payload = readPayload(record.extensions)

  for (const [key, value] of Object.entries(record)) {
    if (canonicalFields.has(key) || key === 'extensions' || !isJsonValue(value))
      continue
    payload[key] = structuredClone(value)
  }
  payloads.set(owner, payload)
}

export const runExtensionSerializeHook = <T extends object>(
  owner: object,
  canonical: T,
  canonicalFields: ReadonlySet<string>,
  hook?: (data: T) => unknown
): T => {
  const payload = payloads.get(owner) ?? {}
  const view = cloneSerialisable(canonical)
  Object.assign(view, structuredClone(payload), {
    extensions: structuredClone(payload)
  })
  hook?.(view)
  hydrateExtensionPayload(owner, view, canonicalFields)

  const result = payloads.get(owner) ?? {}
  return Object.keys(result).length
    ? Object.assign(canonical, { extensions: structuredClone(result) })
    : canonical
}

export const extensionConfigureView = <T extends object>(
  owner: object,
  canonical: T
): T =>
  Object.assign(
    cloneSerialisable(canonical),
    structuredClone(payloads.get(owner))
  )
