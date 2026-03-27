/** Build an input item key from nodeId and widgetName. */
export function inputItemKey(
  nodeId: string | number,
  widgetName: string
): string {
  return `input:${nodeId}:${widgetName}`
}

/** Build a group item key from groupId. */
export function groupItemKey(groupId: string): string {
  return `group:${groupId}`
}

/** Parse an input item key into its nodeId and widgetName parts. Returns null if not an input key. */
export function parseInputItemKey(
  key: string
): { nodeId: string; widgetName: string } | null {
  if (!key.startsWith('input:')) return null
  const parts = key.split(':')
  return { nodeId: parts[1], widgetName: parts.slice(2).join(':') }
}

/** Parse a group item key into its groupId. Returns null if not a group key. */
export function parseGroupItemKey(key: string): string | null {
  if (!key.startsWith('group:')) return null
  return key.slice('group:'.length)
}
