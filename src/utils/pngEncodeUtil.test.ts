import { describe, expect, it } from 'vitest'

import type { DecodedPng } from './__fixtures__/decodePng'
import { decodePng, readU32be } from './__fixtures__/decodePng'
import { encodeRgbaAsPng } from './pngEncodeUtil'

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
    // The whole point of this encoder: canvas.toBlob() would zero these.
    const data = new Uint8ClampedArray([
      200,
      100,
      50,
      0, // transparent, but RGB must survive
      10,
      20,
      30,
      255
    ])

    const decoded = await encodeAndDecode(data, 2, 1)

    expect(Array.from(decoded.pixels)).toEqual([
      200, 100, 50, 0, 10, 20, 30, 255
    ])
  })

  it('produces chunks with valid CRCs (decodable by an external inflater)', async () => {
    // decodePng already inflates the IDAT stream with node:zlib, which
    // validates the zlib framing; here assert the CRC bytes explicitly.
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

// Independent CRC-32 implementation (bitwise, no table) to cross-check the
// encoder's table-based one.
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
