type ZIndexEntry = {
  key: string
  value: number
}

let entries: ZIndexEntry[] = []

export const zIndexManager = {
  set(key: string, element: HTMLElement, baseZIndex: number) {
    const last = entries.at(-1) ?? { key, value: baseZIndex }
    const value = last.value + (last.key === key ? 0 : baseZIndex) + 1
    entries.push({ key, value })
    element.style.zIndex = String(value)
  },

  clear(element: HTMLElement) {
    const value = Number.parseInt(element.style.zIndex, 10) || 0
    entries = entries.filter((entry) => entry.value !== value)
    element.style.zIndex = ''
  },

  getCurrent(_key: string) {
    return entries.at(-1)?.value ?? 0
  }
}
