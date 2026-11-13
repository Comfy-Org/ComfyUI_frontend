import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createImageOutput } from './imageOutput'
import { encodeRgbaAsPng } from './pngEncodeUtil'
import { decodePng } from './testing/decodePng'

describe('createImageOutput', () => {
  let pixelsByCanvas: WeakMap<CanvasImageSource, Uint8ClampedArray>
  const originalCreateElement = document.createElement.bind(document)

  function createCanvas(data = new Uint8ClampedArray(8)): HTMLCanvasElement {
    const canvas: HTMLCanvasElement = fromPartial<HTMLCanvasElement>({
      width: 2,
      height: 1,
      getContext: (): CanvasRenderingContext2D => ctx,
      toBlob: vi.fn((callback: BlobCallback) => {
        void encodeRgbaAsPng({
          data,
          width: canvas.width,
          height: canvas.height
        }).then(callback)
      })
    })
    const ctx: CanvasRenderingContext2D = fromPartial<CanvasRenderingContext2D>(
      {
        canvas,
        globalCompositeOperation: 'source-over',
        drawImage(source: CanvasImageSource) {
          if (ctx.globalCompositeOperation !== 'source-over') {
            throw new Error('Unsupported canvas composite operation')
          }
          const pixels = pixelsByCanvas.get(source)
          if (!pixels) throw new Error('Missing canvas pixels')
          for (let i = 0; i < data.length; i += 4) {
            if (pixels[i + 3] === 255) data.set(pixels.subarray(i, i + 4), i)
          }
        },
        getImageData: () =>
          fromPartial<ImageData>({
            data: new Uint8ClampedArray(data),
            width: 2,
            height: 1
          }),
        putImageData(imageData: ImageData) {
          data.set(imageData.data)
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) data.fill(0, i, i + 3)
          }
        }
      }
    )
    pixelsByCanvas.set(canvas, data)
    return canvas
  }

  beforeEach(() => {
    pixelsByCanvas = new WeakMap()
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      return tag === 'canvas'
        ? createCanvas()
        : originalCreateElement(tag, options)
    })
  })

  it('returns the four composited layers and preserves RGB beneath the mask', async () => {
    const imgCanvas = createCanvas(
      new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 255])
    )
    const paintCanvas = createCanvas(
      new Uint8ClampedArray([0, 0, 0, 0, 70, 80, 90, 255])
    )
    const maskCanvas = createCanvas(
      new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 128])
    )
    const output = await createImageOutput({
      imgCanvas,
      paintCanvas,
      maskCanvas
    })
    const layers = [
      output.maskedImage,
      output.paintLayer,
      output.paintedImage,
      output.paintedMaskedImage
    ]
    const decoded = await Promise.all(
      layers.map(async ({ blob }) =>
        decodePng(new Uint8Array(await blob.arrayBuffer()))
      )
    )

    expect(
      decoded.map(({ width, height, pixels }) => ({
        width,
        height,
        pixels: Array.from(pixels)
      }))
    ).toEqual([
      { width: 2, height: 1, pixels: [200, 100, 50, 0, 10, 20, 30, 127] },
      { width: 2, height: 1, pixels: [0, 0, 0, 0, 70, 80, 90, 255] },
      { width: 2, height: 1, pixels: [200, 100, 50, 255, 70, 80, 90, 255] },
      { width: 2, height: 1, pixels: [200, 100, 50, 0, 70, 80, 90, 127] }
    ])
    expect(Array.from(pixelsByCanvas.get(imgCanvas)!)).toEqual([
      200, 100, 50, 255, 10, 20, 30, 255
    ])
  })

  it('rejects when a canvas cannot produce its PNG blob', async () => {
    const imgCanvas = createCanvas()
    const paintCanvas = createCanvas()
    const maskCanvas = createCanvas()
    const failedCanvas = createCanvas()
    vi.mocked(failedCanvas.toBlob).mockImplementation((callback) =>
      callback(null)
    )
    vi.mocked(document.createElement).mockReturnValue(failedCanvas)

    await expect(
      createImageOutput({ imgCanvas, paintCanvas, maskCanvas })
    ).rejects.toThrow('Failed to create blob from canvas')
  })
})
