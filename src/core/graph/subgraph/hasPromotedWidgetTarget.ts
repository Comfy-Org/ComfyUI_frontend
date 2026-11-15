interface PromotedWidgetExpansion<T> {
  hasWidget: boolean
  nested: readonly T[]
}

export function hasPromotedWidgetTarget<T>(
  root: T,
  maxDepth: number,
  keyOf: (value: T) => unknown,
  expand: (value: T) => PromotedWidgetExpansion<T>
): boolean {
  const active = new Set<unknown>()
  const resolved = new Map<unknown, boolean>()

  const visit = (
    value: T,
    depth: number
  ): { found: boolean; truncated: boolean } => {
    const key = keyOf(value)
    const settled = resolved.get(key)
    if (settled !== undefined) return { found: settled, truncated: false }
    if (active.has(key)) return { found: false, truncated: false }
    active.add(key)

    const { hasWidget, nested } = expand(value)
    let found = hasWidget
    let truncated = false
    for (const child of nested) {
      if (found) break
      if (depth >= maxDepth) {
        truncated = true
        continue
      }
      const result = visit(child, depth + 1)
      found = result.found
      truncated ||= result.truncated
    }

    active.delete(key)
    if (found || !truncated) resolved.set(key, found)
    return { found, truncated }
  }

  return visit(root, 0).found
}
