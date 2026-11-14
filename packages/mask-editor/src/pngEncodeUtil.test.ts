import { describe, expect, it } from 'vitest'

import type { DecodedPng } from './testing/decodePng'
import { decodePng, readU32be } from './testing/decodePng'
import { encodeRgbaAsPng, insertPngTextChunk } from './pngEncodeUtil'

async function encodeAndDecode(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Promise<DecodedPng> {
  const blob = await encodeRgbaAsPng({ data, width, height })
  expect(blob.type).toBe('image/png')
  return decodePng(new Uint8Array(await blob.arrayBuffer()))
}

describe('encodeRgbaAsPng', () => {
  it('round-trips RGBA pixels losslessly', async () => {
    const width = 3
    const height = 2
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i++) data[i] = (i * 37) % 256

    const decoded = await encodeAndDecode(data, width, height)

    expect(decoded.width).toBe(width)
    expect(decoded.height).toBe(height)
    expect(Array.from(decoded.pixels)).toEqual(Array.from(data))
  })

  it('preserves RGB values of fully transparent pixels', async () => {
    const data = new Uint8ClampedArray([200, 100, 50, 0, 10, 20, 30, 255])

    const decoded = await encodeAndDecode(data, 2, 1)

    expect(Array.from(decoded.pixels)).toEqual([
      200, 100, 50, 0, 10, 20, 30, 255
    ])
  })

  it('produces chunks with valid CRCs (decodable by an external inflater)', async () => {
    const data = new Uint8ClampedArray([1, 2, 3, 4])
    const blob = await encodeRgbaAsPng({ data, width: 1, height: 1 })
    const bytes = new Uint8Array(await blob.arrayBuffer())

    let offset = 8
    while (offset < bytes.length) {
      const length = readU32be(bytes, offset)
      const typeAndData = bytes.subarray(offset + 4, offset + 8 + length)
      const storedCrc = readU32be(bytes, offset + 8 + length)
      expect(crc32Reference(typeAndData)).toBe(storedCrc)
      offset += 8 + length + 4
    }
  })

  it('encodes larger buffers row-correctly', async () => {
    const width = 64
    const height = 48
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        data[i] = x * 4
        data[i + 1] = y * 5
        data[i + 2] = (x + y) % 256
        data[i + 3] = x % 3 === 0 ? 0 : 255
      }
    }

    const decoded = await encodeAndDecode(data, width, height)

    expect(Array.from(decoded.pixels)).toEqual(Array.from(data))
  })
})

describe('insertPngTextChunk', () => {
  it('inserts valid Unicode metadata after IHDR without changing existing PNG bytes', async () => {
    const data = new Uint8ClampedArray([200, 100, 50, 0, 10, 20, 30, 255])
    const png = await encodeRgbaAsPng({ data, width: 2, height: 1 })
    const original = new Uint8Array(await png.arrayBuffer())
    const text = JSON.stringify({ title: '工作流 🎨 café' })

    const result = await insertPngTextChunk(png, 'workflow', text)
    const bytes = new Uint8Array(await result.arrayBuffer())

    const ihdrEnd = 33
    const length = readU32be(bytes, ihdrEnd)
    const chunkEnd = ihdrEnd + 12 + length
    expect(result.type).toBe('image/png')
    expect(bytes.subarray(0, ihdrEnd)).toEqual(original.subarray(0, ihdrEnd))
    expect(bytes.subarray(chunkEnd)).toEqual(original.subarray(ihdrEnd))
    expect(
      new TextDecoder().decode(bytes.subarray(ihdrEnd + 4, ihdrEnd + 8))
    ).toBe('iTXt')
    expect(
      new TextDecoder().decode(bytes.subarray(ihdrEnd + 8, chunkEnd - 4))
    ).toBe(`workflow\0\0\0\0\0${text}`)
    expect(readU32be(bytes, chunkEnd - 4)).toBe(
      crc32Reference(bytes.subarray(ihdrEnd + 4, chunkEnd - 4))
    )
    expect(decodePng(bytes).pixels).toEqual(new Uint8Array(data))
  })
})

function crc32Reference(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
