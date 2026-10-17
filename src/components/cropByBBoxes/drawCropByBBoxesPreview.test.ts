import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import {
  drawCropByBBoxesPreview,
  renderCropByBBoxesPreview
} from '@/components/cropByBBoxes/drawCropByBBoxesPreview'
import type { CropPreviewScene } from '@/components/cropByBBoxes/drawCropByBBoxesPreview'

type Call = [method: string, ...args: unknown[]]

function recordingContext() {
  const calls: Call[] = []
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args])
    }
  const ctx = fromPartial<CanvasRenderingContext2D>({
    clearRect: record('clearRect'),
    drawImage: record('drawImage'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    fill: record('fill'),
    fillText: record('fillText'),
    setLineDash: record('setLineDash'),
    measureText: () => fromPartial<TextMetrics>({ width: 40 })
  })
  return { ctx, of: (m: string) => calls.filter(([c]) => c === m) }
}

const image = fromPartial<CanvasImageSource>({})

const baseScene: CropPreviewScene = {
  image,
  imageWidth: 200,
  imageHeight: 100,
  boxes: [
    { x: 20, y: 10, width: 40, height: 30 },
    { x: 80, y: 20, width: 20, height: 20 }
  ]
}

const cropScene: CropPreviewScene = {
  ...baseScene,
  crop: {
    region: { x: 20, y: 10, width: 80, height: 40 },
    frame: { x: -90, y: -45, width: 300, height: 150 },
    cropLabel: 'Crop 80 × 40',
    outputLabel: 'Output 300 × 150 · pad'
  }
}

describe('drawCropByBBoxesPreview', () => {
  it('draws only the source before boxes exist', () => {
    const { ctx, of } = recordingContext()

    drawCropByBBoxesPreview(ctx, 408, 208, { ...baseScene, boxes: [] })

    expect(of('drawImage')).toEqual([['drawImage', image, 4, 4, 400, 200]])
    expect(of('fill')).toHaveLength(0)
    expect(of('fillText')).toHaveLength(0)
  })

  it('outlines every detection on the source panel', () => {
    const { ctx, of } = recordingContext()

    drawCropByBBoxesPreview(ctx, 408, 208, baseScene)

    expect(of('strokeRect')).toEqual([
      ['strokeRect', 44, 24, 80, 60],
      ['strokeRect', 164, 44, 40, 40]
    ])
  })

  it('blacks out the padding and grows the view to fit the output frame', () => {
    const { ctx, of } = recordingContext()

    drawCropByBBoxesPreview(ctx, 308, 158, cropScene)

    expect(of('drawImage')).toEqual([['drawImage', image, 94, 49, 200, 100]])
    expect(of('fill')).toEqual([
      ['fill', 'evenodd'],
      ['fill', 'evenodd']
    ])
    expect(of('rect').slice(-2)).toEqual([
      ['rect', 4, 4, 300, 150],
      ['rect', 114, 59, 80, 40]
    ])
    expect(of('strokeRect').slice(-2)).toEqual([
      ['strokeRect', 114, 59, 80, 40],
      ['strokeRect', 1, 1, 306, 156]
    ])
    expect(of('setLineDash')).toEqual([
      ['setLineDash', [6, 4]],
      ['setLineDash', []]
    ])
    expect(of('fillText').map(([, text]) => text)).toEqual([
      'Crop 80 × 40',
      'Output 300 × 150 · pad'
    ])
  })

  it('draws the stretch size frame and keeps the output frame off the crop', () => {
    const { ctx, of } = recordingContext()
    const region = { x: 20, y: 10, width: 80, height: 40 }

    drawCropByBBoxesPreview(ctx, 408, 208, {
      ...baseScene,
      crop: {
        region,
        frame: region,
        sizeFrame: { x: 0, y: 0, width: 200, height: 100 },
        cropLabel: 'Crop 80 × 40',
        outputLabel: 'Output 100 × 100 · stretch'
      }
    })

    expect(of('strokeRect').at(-1)).toEqual(['strokeRect', 41, 21, 166, 86])
    expect(of('strokeRect').at(-3)).toEqual(['strokeRect', 44, 24, 160, 80])
    expect(of('strokeRect').at(-2)).toEqual(['strokeRect', 4, 4, 400, 200])
  })

  it('renders at device pixel ratio onto the canvas', () => {
    const { ctx, of } = recordingContext()
    const setTransform = vi.fn()
    const canvas = fromPartial<HTMLCanvasElement>({
      getContext: () => Object.assign(ctx, { setTransform })
    })
    vi.stubGlobal('devicePixelRatio', 2)

    renderCropByBBoxesPreview(canvas, 400, 200, baseScene)

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(of('drawImage')).toHaveLength(1)
  })
})
