import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

interface PngMatchOptions {
  /**
   * Largest per-channel difference, 0–1, that still counts as matching.
   * Matching renders differ by at most 3/255; a 1px misalignment shifts the
   * background grid by 5–7/255.
   */
  threshold?: number
  maxDiffPixelRatio?: number
}

export async function expectPngsToMatch(
  page: Page,
  testInfo: TestInfo,
  name: string,
  actual: Buffer,
  expected: Buffer,
  { threshold = 4 / 255, maxDiffPixelRatio = 0 }: PngMatchOptions = {}
): Promise<void> {
  const result = await page.evaluate(
    async ({ pngs, threshold }) => {
      const [a, b] = await Promise.all(
        pngs.map(async (png) => {
          const image = new Image()
          image.src = `data:image/png;base64,${png}`
          await image.decode()
          const ctx = new OffscreenCanvas(image.width, image.height).getContext(
            '2d',
            { willReadFrequently: true }
          )
          if (!ctx) throw new Error('Cannot decode PNG')
          ctx.drawImage(image, 0, 0)
          return ctx.getImageData(0, 0, image.width, image.height)
        })
      )
      if (a.width !== b.width || a.height !== b.height)
        return {
          error: `size ${a.width}x${a.height} differs from ${b.width}x${b.height}`
        }

      const diff = new ImageData(a.width, a.height)
      const limit = threshold * 255
      let mismatched = 0
      for (let i = 0; i < a.data.length; i += 4) {
        let delta = 0
        for (let c = 0; c < 4; c++)
          delta = Math.max(delta, Math.abs(a.data[i + c] - b.data[i + c]))
        const bad = delta > limit
        if (bad) mismatched++
        diff.data.set(bad ? [255, 0, 0, 255] : [0, 0, 0, 32], i)
      }
      if (!mismatched) return { ratio: 0 }

      const canvas = new OffscreenCanvas(a.width, a.height)
      canvas.getContext('2d')?.putImageData(diff, 0, 0)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      return {
        ratio: mismatched / (a.width * a.height),
        diff: dataUrl.split(',')[1]
      }
    },
    { pngs: [actual, expected].map((png) => png.toString('base64')), threshold }
  )

  if (result.error || result.diff) {
    const images = {
      actual,
      expected,
      ...(result.diff && { diff: Buffer.from(result.diff, 'base64') })
    }
    for (const [suffix, body] of Object.entries(images))
      await testInfo.attach(`${name}-${suffix}.png`, {
        body,
        contentType: 'image/png'
      })
  }
  expect(result.error, `${name} image size`).toBeUndefined()
  expect(result.ratio, `${name} differing pixel ratio`).toBeLessThanOrEqual(
    maxDiffPixelRatio
  )
}
