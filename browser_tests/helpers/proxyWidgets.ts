export type ProxyWidgetEntry = [string, string]

export function isProxyWidgetEntry(entry: unknown): entry is ProxyWidgetEntry {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    typeof entry[1] === 'string'
  )
}

export function normalizeProxyWidgets(value: unknown): ProxyWidgetEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isProxyWidgetEntry)
}
