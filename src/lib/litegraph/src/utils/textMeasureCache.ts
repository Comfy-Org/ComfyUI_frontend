const cache = new Map<string, number>()

export function cachedMeasureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontStyle = ctx.font
): number {
  const key = `${fontStyle}\0${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const { font } = ctx
  try {
    ctx.font = fontStyle
    const width = ctx.measureText(text).width
    cache.set(key, width)
    return width
  } finally {
    ctx.font = font
  }
}

export function clearTextMeasureCache(): void {
  cache.clear()
}
