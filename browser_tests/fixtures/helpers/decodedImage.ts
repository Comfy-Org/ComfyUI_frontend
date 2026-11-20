import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export interface DecodedImage {
  width: number
  height: number
  rgba: Buffer
}

type RgbTest = (r: number, g: number, b: number) => boolean

/** Decodes a PNG to RGBA bytes using the page's image decoder. */
export async function decodePng(
  comfyPage: ComfyPage,
  png: Buffer
): Promise<DecodedImage> {
  const { width, height, base64 } = await comfyPage.page.evaluate(
    async (encoded) => {
      const response = await fetch(`data:image/png;base64,${encoded}`)
      const bitmap = await createImageBitmap(await response.blob())
      const context = new OffscreenCanvas(
        bitmap.width,
        bitmap.height
      ).getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      const bytes = context.getImageData(0, 0, bitmap.width, bitmap.height).data
      let binary = ''
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return {
        width: bitmap.width,
        height: bitmap.height,
        base64: btoa(binary)
      }
    },
    png.toString('base64')
  )
  return { width, height, rgba: Buffer.from(base64, 'base64') }
}

/** Pixel positions whose colour passes `test`. */
export function matchingPixels(
  image: DecodedImage,
  test: RgbTest
): { x: number; y: number }[] {
  const matches: { x: number; y: number }[] = []
  for (let offset = 0; offset < image.rgba.length; offset += 4) {
    const r = image.rgba[offset]
    const g = image.rgba[offset + 1]
    const b = image.rgba[offset + 2]
    if (!test(r, g, b)) continue
    const index = offset / 4
    matches.push({ x: index % image.width, y: Math.floor(index / image.width) })
  }
  return matches
}

/** Whether a colour is within `tolerance` of `rgb` on every channel. */
export const nearColour =
  (rgb: readonly [number, number, number], tolerance: number): RgbTest =>
  (r, g, b) =>
    Math.abs(r - rgb[0]) <= tolerance &&
    Math.abs(g - rgb[1]) <= tolerance &&
    Math.abs(b - rgb[2]) <= tolerance
