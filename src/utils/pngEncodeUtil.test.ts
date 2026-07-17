import { inflateSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'

import { encodeRgbaAsPng } from './pngEncodeUtil'

beforeAll(async () => {
  if (typeof globalThis.CompressionStream === 'undefined') {
    const { CompressionStream } = await import('node:stream/web')
    globalThis.CompressionStream =
      CompressionStream as typeof globalThis.CompressionStream
  }
})

interface DecodedPng {
  width: number
  height: number
  pixels: Uint8Array
}

function readU32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

function decodePng(bytes: Uint8Array): DecodedPng {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  expect(Array.from(bytes.subarray(0, 8))).toEqual(signature)

  let offset = 8
  let width = 0
  let height = 0
  const idatParts: Uint8Array[] = []

  while (offset < bytes.length) {
    const length = readU32be(bytes, offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = readU32be(data, 0)
      height = readU32be(data, 4)
      expect(data[8]).toBe(8) // bit depth
      expect(data[9]).toBe(6) // color type RGBA
    } else if (type === 'IDAT') {
      idatParts.push(data)
    }

    offset += 8 + length + 4
  }

  const compressed = Buffer.concat(idatParts)
  const raw = inflateSync(compressed)

  const bytesPerRow = width * 4
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (bytesPerRow + 1)
    expect(raw[rowStart]).toBe(0) // filter byte: None
    pixels.set(
      raw.subarray(rowStart + 1, rowStart + 1 + bytesPerRow),
      y * bytesPerRow
    )
  }

  return { width, height, pixels }
}

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
