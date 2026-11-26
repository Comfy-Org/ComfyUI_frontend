import { inflateSync } from 'node:zlib'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export interface DecodedImage {
  width: number
  height: number
  rgba: Buffer
}

type RgbTest = (r: number, g: number, b: number) => boolean

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

interface PngHeader {
  width: number
  height: number
  channels: number
}

function readPngChunks(png: Buffer): { header: PngHeader; data: Buffer } {
  const parts: Buffer[] = []
  let header: PngHeader | undefined
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const chunk = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      const [bitDepth, colourType, , , interlace] = chunk.subarray(8, 13)
      if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colourType))
        throw new Error('Only 8-bit, non-interlaced RGB or RGBA PNGs decode')
      header = {
        width: chunk.readUInt32BE(0),
        height: chunk.readUInt32BE(4),
        channels: colourType === 6 ? 4 : 3
      }
    }
    if (type === 'IDAT') parts.push(chunk)
    offset += length + 12
  }
  if (!header) throw new Error('PNG has no IHDR chunk')
  return { header, data: inflateSync(Buffer.concat(parts)) }
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft
  const toLeft = Math.abs(estimate - left)
  const toUp = Math.abs(estimate - up)
  const toUpLeft = Math.abs(estimate - upLeft)
  if (toLeft <= toUp && toLeft <= toUpLeft) return left
  return toUp <= toUpLeft ? up : upLeft
}

function unfilterRow(
  filter: number,
  line: Buffer,
  previous: Buffer,
  channels: number
): Buffer {
  const row = Buffer.alloc(line.length)
  for (let x = 0; x < line.length; x++) {
    const left = x >= channels ? row[x - channels] : 0
    const up = previous[x]
    const upLeft = x >= channels ? previous[x - channels] : 0
    const predictors = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)]
    row[x] = (line[x] + predictors[filter]) & 0xff
  }
  return row
}

/** Decodes an 8-bit RGB or RGBA PNG, such as a Playwright screenshot, without a browser round trip. */
export function decodePngBuffer(png: Buffer): DecodedImage {
  const { header, data } = readPngChunks(png)
  const { width, height, channels } = header
  const stride = width * channels
  const rgba = Buffer.alloc(width * height * 4)
  let previous: Buffer = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1)
    const row = unfilterRow(
      data[start],
      data.subarray(start + 1, start + 1 + stride),
      previous,
      channels
    )
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4
      row.copy(rgba, target, x * channels, x * channels + 3)
      rgba[target + 3] = channels === 4 ? row[x * channels + 3] : 255
    }
    previous = row
  }
  return { width, height, rgba }
}

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
