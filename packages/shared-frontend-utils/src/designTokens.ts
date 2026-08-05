export type DesignTokenName = `--${string}`

/**
 * Reads a design-system token off the document so canvas and WebGL code can use
 * the same value CSS does. Both need a concrete color string, so they cannot
 * reference `var(--token)` directly the way a stylesheet can.
 *
 * Names after the first are fallbacks, tried in order, so a fallback stays a
 * token rather than becoming a literal.
 */
export function readDesignToken(...names: DesignTokenName[]): string {
  if (typeof document === 'undefined') return ''
  const styles = getComputedStyle(document.documentElement)
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim()
    if (value) return value
  }
  return ''
}

/** Same value as `rgb(from var(name) r g b / alpha)`, for canvas fill/stroke. */
export function readDesignTokenRgba(
  name: DesignTokenName,
  alpha: number
): string {
  const rgb = parseRgb(readDesignToken(name))
  if (!rgb) return ''
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function parseRgb(
  color: string
): { r: number; g: number; b: number } | undefined {
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hexMatch) {
    const digits =
      hexMatch[1].length === 3 ? hexMatch[1].replace(/./g, '$&$&') : hexMatch[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16)
    }
  }
  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(
    color.trim()
  )
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3])
    }
  }
  return undefined
}
