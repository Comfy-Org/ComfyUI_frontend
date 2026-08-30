export function loadSplitterSizes(
  key: string,
  panelCount: number
): number[] | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (
      Array.isArray(value) &&
      value.length === panelCount &&
      value.every(
        (size): size is number =>
          typeof size === 'number' && Number.isFinite(size)
      )
    ) {
      return value
    }
  } catch {
    return undefined
  }
  return undefined
}

export function saveSplitterSizes(key: string, sizes: number[]) {
  localStorage.setItem(key, JSON.stringify(sizes))
}
