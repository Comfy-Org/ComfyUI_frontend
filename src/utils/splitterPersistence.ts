function getStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadSplitterSizes(
  key: string,
  panelCount: number,
  storage = getStorage()
): number[] | undefined {
  if (!storage) return undefined
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? 'null')
    if (
      !Array.isArray(value) ||
      !value.every(
        (size): size is number =>
          typeof size === 'number' && Number.isFinite(size) && size >= 0
      ) ||
      value.reduce((total, size) => total + size, 0) <= 0
    ) {
      return undefined
    }
    if (value.length === panelCount) return value
    if (
      panelCount === 2 &&
      value.length === 3 &&
      (key === 'builder-splitter' || key === 'builder-splitter-right')
    ) {
      const visible =
        key === 'builder-splitter' ? value.slice(1) : value.slice(0, 2)
      const total = visible[0] + visible[1]
      if (total > 0) return visible.map((size) => (size / total) * 100)
    }
  } catch {
    return undefined
  }
  return undefined
}

export function saveSplitterSizes(
  key: string,
  sizes: number[],
  storage = getStorage()
) {
  try {
    storage?.setItem(key, JSON.stringify(sizes))
    return Boolean(storage)
  } catch {
    return false
  }
}
