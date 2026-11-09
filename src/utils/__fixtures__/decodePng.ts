import { inflateSync } from 'node:zlib'

export interface DecodedPng {
  width: number
  height: number
  pixels: Uint8Array
}

export function readU32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Minimal test-only PNG reader for 8-bit RGBA images written with scanline
 * filter None (the shape `encodeRgbaAsPng` produces). Throws on anything else.
 */
export function decodePng(bytes: Uint8Array): DecodedPng {
  PNG_SIGNATURE.forEach((expected, i) => {
    if (bytes[i] !== expected) throw new Error('missing PNG signature')
  })

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
      if (data[8] !== 8) throw new Error(`unsupported bit depth ${data[8]}`)
      if (data[9] !== 6) throw new Error(`unsupported color type ${data[9]}`)
    } else if (type === 'IDAT') {
      idatParts.push(data)
    }

    offset += 8 + length + 4
  }

  const raw = inflateSync(Buffer.concat(idatParts))

  const bytesPerRow = width * 4
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (bytesPerRow + 1)
    if (raw[rowStart] !== 0) {
      throw new Error(`unsupported scanline filter ${raw[rowStart]}`)
    }
    pixels.set(
      raw.subarray(rowStart + 1, rowStart + 1 + bytesPerRow),
      y * bytesPerRow
    )
  }

  return { width, height, pixels }
}
