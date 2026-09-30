/**
 * A side panel's size (%) from the first usable PrimeVue Splitter state among
 * `stateKeys`, saved before side panels were pinned in pixels. `edge` picks
 * the first or the last panel of the saved sizes.
 */
export function savedPanelPercent(
  readState: (stateKey: string) => string | null,
  stateKeys: string[],
  edge: 'first' | 'last'
): number | null {
  for (const stateKey of stateKeys) {
    try {
      const sizes: unknown = JSON.parse(readState(stateKey) ?? 'null')
      if (!Array.isArray(sizes)) continue
      const size: unknown = edge === 'first' ? sizes[0] : sizes.at(-1)
      if (typeof size === 'number' && size > 0 && size < 100) return size
    } catch {
      continue
    }
  }
  return null
}
