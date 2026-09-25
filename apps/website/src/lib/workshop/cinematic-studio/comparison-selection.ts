const KEY_PREFIX = 'cinematic-comparison-selection-v1:'
const MAX_JSON_LENGTH = 4096

function validPair(value: unknown): value is readonly [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (id) => typeof id === 'string' && id.trim().length > 0 && id.length <= 200
    ) &&
    value[0] !== value[1]
  )
}

export function readComparisonSelection(
  namespace?: string
): readonly [string, string] | undefined {
  if (!namespace?.trim()) return
  try {
    const raw = localStorage.getItem(KEY_PREFIX + encodeURIComponent(namespace))
    if (!raw || raw.length > MAX_JSON_LENGTH) return
    const parsed: unknown = JSON.parse(raw)
    if (validPair(parsed)) return [parsed[0], parsed[1]]
  } catch {
    // Browser storage is optional, including during server rendering.
  }
  return undefined
}

export function saveComparisonSelection(
  namespace: string | undefined,
  pair: readonly [string, string]
): void {
  if (!namespace?.trim() || !validPair(pair)) return
  try {
    localStorage.setItem(
      KEY_PREFIX + encodeURIComponent(namespace),
      JSON.stringify([pair[0], pair[1]])
    )
  } catch {
    // Storage failure must never prevent comparing the selected creations.
  }
}
