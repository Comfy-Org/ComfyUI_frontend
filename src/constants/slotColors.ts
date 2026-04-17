export const MAX_MULTITYPE_SLICES = 3

export function getSlotColor(type?: string | number | null): string {
  if (!type) return '#AAA'
  const typeStr = String(type).toUpperCase()
  return `var(--color-datatype-${typeStr}, #AAA)`
}
