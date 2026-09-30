/**
 * The sidebar's size (%) from the first usable PrimeVue Splitter state among
 * `stateKeys`, saved before side panels were pinned in pixels.
 */
export function savedSidebarPercent(
  readState: (stateKey: string) => string | null,
  stateKeys: string[],
  sidebarLocation: 'left' | 'right'
): number | null {
  for (const stateKey of stateKeys) {
    try {
      const sizes: unknown = JSON.parse(readState(stateKey) ?? 'null')
      if (!Array.isArray(sizes)) continue
      const size: unknown = sidebarLocation === 'left' ? sizes[0] : sizes.at(-1)
      if (typeof size === 'number' && size > 0 && size < 100) return size
    } catch {
      continue
    }
  }
  return null
}
