import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position, Size } from '@e2e/fixtures/types'

type Region = Position & Size

export async function alignCanvasWithExport(
  comfyPage: ComfyPage,
  exported: Buffer,
  region?: Region
) {
  const { page } = comfyPage
  const pixelRatio = await page.evaluate(() => window.devicePixelRatio)
  const width = exported.readUInt32BE(16)
  const height = exported.readUInt32BE(20)
  const bounds = await page.evaluate(() => {
    const { graph } = window.app!.canvas
    const bounds = [Infinity, Infinity, -Infinity, -Infinity]
    for (const item of graph!.positionableItems()) {
      const [x, y, w, h] = item.boundingRect
      bounds[0] = Math.min(bounds[0], x)
      bounds[1] = Math.min(bounds[1], y)
      bounds[2] = Math.max(bounds[2], x + w)
      bounds[3] = Math.max(bounds[3], y + h)
    }
    return bounds
  })
  const scale = Math.min(
    width / (bounds[2] - bounds[0] + 128),
    height / (bounds[3] - bounds[1] + 128)
  )
  const crop = region
    ? {
        x: Math.floor((region.x - bounds[0] + 64) * scale),
        y: Math.floor((region.y - bounds[1] + 64) * scale),
        width: Math.floor(region.width * scale),
        height: Math.floor(region.height * scale)
      }
    : { x: 0, y: 0, width, height }

  await comfyPage.canvasOps.setScale(scale / pixelRatio)
  await comfyPage.canvasOps.setOffset([
    64 - bounds[0] - crop.x / scale,
    64 - bounds[1] - crop.y / scale
  ])
  await comfyPage.canvasOps.moveMouseToEmptyArea()
  await comfyPage.canvasOps.waitForViewToSettle()

  const canvasBox = await comfyPage.canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas is not visible')
  const clip = {
    x: canvasBox.x,
    y: canvasBox.y,
    width: crop.width / pixelRatio,
    height: crop.height / pixelRatio
  }
  if (!region) return { clip, exported }

  const cropped = await page.evaluate(
    async ({ png, crop }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Cannot crop exported PNG')
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      )
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { png: exported.toString('base64'), crop }
  )
  return { clip, exported: Buffer.from(cropped, 'base64') }
}
