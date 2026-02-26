export function createBitmapCache(
  svg: HTMLImageElement,
  bitmapSize: number
) {
  let bitmap: HTMLCanvasElement | null = null

  return {
    get(): HTMLCanvasElement | HTMLImageElement {
      if (bitmap) return bitmap
      if (!svg.complete || svg.naturalWidth === 0) return svg

      const canvas = document.createElement('canvas')
      canvas.width = bitmapSize
      canvas.height = bitmapSize
      const ctx = canvas.getContext('2d')
      if (!ctx) return svg

      ctx.drawImage(svg, 0, 0, bitmapSize, bitmapSize)
      bitmap = canvas
      return bitmap
    }
  }
}
