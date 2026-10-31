const cache = new Map<string, number>()
const fonts =
  typeof document !== 'undefined' && 'fonts' in document
    ? document.fonts
    : undefined

export function cachedMeasureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontStyle = ctx.font
): number {
  const key = `${fontStyle}\0${text}`
  const cached = fonts?.status === 'loading' ? undefined : cache.get(key)
  if (cached !== undefined) return cached

  const { font } = ctx
  try {
    ctx.font = fontStyle
    const width = ctx.measureText(text).width
    if (fonts?.status !== 'loading') cache.set(key, width)
    return width
  } finally {
    ctx.font = font
  }
}

export function clearTextMeasureCache(): void {
  cache.clear()
}

fonts?.addEventListener('loading', clearTextMeasureCache)
