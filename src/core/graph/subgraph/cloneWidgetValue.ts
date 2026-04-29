/**
 * Deep-clone a widget value for inline serialization or per-instance
 * isolation. Uses `structuredClone` so uncloneable mutable values fail loudly
 * instead of sharing a reference across SubgraphNode instances.
 */
export function cloneWidgetValue<TValue>(value: TValue): TValue {
  if (value == null) return value
  if (typeof value !== 'object' && typeof value !== 'function') return value
  return structuredClone(value)
}
