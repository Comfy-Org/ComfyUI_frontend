export const MAX_MULTITYPE_SLICES = 3

export function getSlotColor(
  type?: string | number | null,
  fallback = '#AAA'
): string {
  if (!type) return fallback
  const typeStr = String(type).toUpperCase()
  return `var(--color-datatype-${typeStr}, ${fallback})`
}
