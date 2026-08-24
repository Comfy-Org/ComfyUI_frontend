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

const isSafeExtensionKey = (key: string): boolean => key !== '__proto__'

const readPayload = (value: unknown): ExtensionPayload => {
  if (
    !isJsonValue(value) ||
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => isSafeExtensionKey(key))
      .map(([key, entry]) => [key, structuredClone(entry)])
  )
}

const cloneSerialisable = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

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
    )
      continue
    target[key] = structuredClone(value)
  }
}

export const hydrateExtensionPayload = (
  owner: object,
  data: object,
  canonicalFields: ReadonlySet<string>
): void => {
  const record = Object.fromEntries(Object.entries(data))
  const payload = readPayload(record.extensions)
  copyExtensionFields(payload, record, canonicalFields)
  payloads.set(owner, payload)
}

export const runExtensionSerializeHook = <T extends object>(
  owner: object,
  canonical: T,
  canonicalFields: ReadonlySet<string>,
  hook?: (data: T) => unknown
): T => {
  const payload = payloads.get(owner) ?? {}
  if (!hook && Object.keys(payload).length === 0) return canonical

  const view = cloneSerialisable(canonical)
  Object.assign(view, {
    extensions: structuredClone(payload)
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
  const result = readPayload(viewRecord.extensions)
  copyExtensionFields(result, viewRecord, canonicalFields)
  payloads.set(owner, result)

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
