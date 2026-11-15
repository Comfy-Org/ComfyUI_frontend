/**
 * A side panel's size (%) from the first usable PrimeVue Splitter state among
 * `stateKeys`, saved before side panels were pinned in pixels. `edge` picks
 * the first or the last panel of the saved sizes, scaled so they sum to 100.
 */
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function savedPanelPercent(
  readState: (stateKey: string) => string | null,
  stateKeys: string[],
  edge: 'first' | 'last'
): number | null {
  for (const stateKey of stateKeys) {
    try {
      const sizes: unknown = JSON.parse(readState(stateKey) ?? 'null')
      if (!Array.isArray(sizes) || !sizes.every(isPositiveNumber)) continue
      const total = sizes.reduce((sum, size) => sum + size, 0)
      const size = edge === 'first' ? sizes[0] : sizes.at(-1)
      if (size !== undefined && size < total) return (size / total) * 100
    } catch {
      continue
    }
  }
  return null
}
