import { expect } from '@playwright/test'

import type { Page } from '@playwright/test'

const landmarkTitles = [
  'First Pipeline Landmark',
  'Middle Pipeline Landmark',
  'CPU Output Branch Landmark',
  'CPU Output Input',
  'CPU Output Landmark'
]

export async function expectLargeWorkflowLandmarkTitlesPainted(page: Page) {
  const evidence = await page.evaluate((landmarkTitles) => {
    const canvas = window.app!.canvas
    const fillText = CanvasRenderingContext2D.prototype.fillText
    const initialScale = canvas.ds.scale
    const initialOffset = [...canvas.ds.offset]
    const snapshotGeometry = () =>
      JSON.stringify({
        nodes: canvas.graph!.nodes.map((node) => [
          node.id,
          node.pos,
          node.size
        ]),
        groups: canvas.graph!.groups.map((group) => [
          group.title,
          group.pos,
          group.size
        ])
      })
    const initialGeometry = snapshotGeometry()
    const snapshotPixels = (context: CanvasRenderingContext2D) =>
      context.getImageData(0, 0, canvas.canvas.width, canvas.canvas.height).data
    const countChangedPixels = (
      before: Uint8ClampedArray,
      after: Uint8ClampedArray,
      bounds: { left: number; top: number; right: number; bottom: number }
    ) => {
      const left = Math.max(0, Math.floor(bounds.left))
      const top = Math.max(0, Math.floor(bounds.top))
      const right = Math.min(canvas.canvas.width, Math.ceil(bounds.right))
      const bottom = Math.min(canvas.canvas.height, Math.ceil(bounds.bottom))
      let changedPixels = 0
      const beforePixels = new Uint32Array(before.buffer)
      const afterPixels = new Uint32Array(after.buffer)
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const index = y * canvas.canvas.width + x
          changedPixels += Number(beforePixels[index] !== afterPixels[index])
        }
      }
      return changedPixels
    }
    const evidence: Array<{
      title: string
      changedPixels: number
      unstablePixels: number
    }> = []

    try {
      canvas.ds.scale = 1
      for (const title of landmarkTitles) {
        const node = canvas.graph!.nodes.find((node) => node.title === title)
        if (node) {
          canvas.centerOnNode(node)
        } else {
          const group = canvas.graph!.groups.find(
            (group) => group.title === title
          )
          if (!group) throw new Error(`Landmark ${title} not found`)
          const dpi = window.devicePixelRatio || 1
          canvas.ds.offset[0] = -group.pos[0] + canvas.canvas.width / (4 * dpi)
          canvas.ds.offset[1] = -group.pos[1] + canvas.canvas.height / (4 * dpi)
        }

        canvas.draw(true, true)
        const context = canvas.canvas.getContext('2d')
        if (!context) throw new Error('Canvas context not available')
        const painted = snapshotPixels(context)
        canvas.draw(true, true)
        const unchanged = snapshotPixels(context)

        let labelBounds:
          | { left: number; top: number; right: number; bottom: number }
          | undefined
        CanvasRenderingContext2D.prototype.fillText = function (
          text,
          x,
          y,
          maxWidth
        ) {
          if (text !== title) {
            fillText.call(this, text, x, y, maxWidth)
            return
          }
          const metrics = this.measureText(text)
          const transform = this.getTransform()
          const corners = [
            transform.transformPoint({
              x: x - metrics.actualBoundingBoxLeft,
              y: y - metrics.actualBoundingBoxAscent
            }),
            transform.transformPoint({
              x: x + metrics.actualBoundingBoxRight,
              y: y + metrics.actualBoundingBoxDescent
            })
          ]
          labelBounds = {
            left: Math.min(...corners.map(({ x }) => x)) - 1,
            top: Math.min(...corners.map(({ y }) => y)) - 1,
            right: Math.max(...corners.map(({ x }) => x)) + 1,
            bottom: Math.max(...corners.map(({ y }) => y)) + 1
          }
        }
        canvas.draw(true, true)
        const suppressed = snapshotPixels(context)
        CanvasRenderingContext2D.prototype.fillText = fillText
        canvas.draw(true, true)
        const restored = snapshotPixels(context)
        if (!labelBounds) {
          throw new Error(`Landmark ${title} title was not painted`)
        }
        evidence.push({
          title,
          changedPixels: countChangedPixels(painted, suppressed, labelBounds),
          unstablePixels:
            countChangedPixels(painted, unchanged, labelBounds) +
            countChangedPixels(painted, restored, labelBounds)
        })
      }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = fillText
      canvas.ds.scale = initialScale
      canvas.ds.offset[0] = initialOffset[0]
      canvas.ds.offset[1] = initialOffset[1]
      canvas.setDirty(true, true)
    }

    if (snapshotGeometry() !== initialGeometry) {
      throw new Error('Landmark paint proof changed graph geometry or identity')
    }

    return evidence
  }, landmarkTitles)

  expect(evidence.map(({ title }) => title)).toEqual(landmarkTitles)
  expect(evidence.map(({ unstablePixels }) => unstablePixels)).toEqual([
    0, 0, 0, 0, 0
  ])
  expect(evidence.every(({ changedPixels }) => changedPixels > 0)).toBe(true)
  return evidence
}
