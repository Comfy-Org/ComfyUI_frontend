export function getSplitterStorageKey(baseKey: string, panelIds: string[]) {
  return `${baseKey}:${panelIds.join(',')}`
}

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

export function saveSplitterSizes(
  key: string,
  sizes: number[],
  storage = getStorage()
) {
  try {
    storage?.setItem(key, JSON.stringify(sizes))
  } catch {
    return
  }
}
