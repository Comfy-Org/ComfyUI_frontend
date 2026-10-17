const OVERFLOW_WIDGET_NAME_RE = /^_extra_(0|[1-9]\d*)$/
const MOUNTED_LAST = Number.MAX_SAFE_INTEGER

export function overflowWidgetIndex(name: string): number | null {
  const match = OVERFLOW_WIDGET_NAME_RE.exec(name)
  return match ? Number(match[1]) : null
}

/**
 * Rank once per entry: live names first, then positional overflow aliases,
 * then unresolved names in their existing order. Rebuild ranks for each call
 * because a selector can replace the live widget list between frames.
 */
export function orderWidgetEntries(
  liveNames: readonly string[],
  entries: readonly [string, unknown][]
): [string, unknown][] {
  const liveIndices = new Map<string, number>()
  for (const [index, name] of liveNames.entries()) {
    if (!liveIndices.has(name)) liveIndices.set(name, index)
  }

  return entries
    .map((entry) => {
      const liveIndex = liveIndices.get(entry[0])
      const overflowIndex =
        liveIndex === undefined ? overflowWidgetIndex(entry[0]) : null
      const rank =
        liveIndex ??
        (overflowIndex === null
          ? MOUNTED_LAST
          : liveNames.length + overflowIndex)
      return { entry, rank }
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ entry }) => entry)
}
