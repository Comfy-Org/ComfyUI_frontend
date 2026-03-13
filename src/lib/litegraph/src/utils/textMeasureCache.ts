const cache = new Map<string, number>()

export function cachedMeasureText(
  ctx: CanvasRenderingContext2D,
  text: string
): number {
  const key = `${ctx.font}\0${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const width = ctx.measureText(text).width
  cache.set(key, width)
  return width
}

export function clearTextMeasureCache(): void {
  cache.clear()
}
