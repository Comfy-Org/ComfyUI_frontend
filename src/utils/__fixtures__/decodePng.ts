import { crc32, inflateSync } from 'node:zlib'

export interface DecodedPng {
  width: number
  height: number
  pixels: Uint8Array
  textChunks: {
    type: 'tEXt' | 'zTXt' | 'iTXt'
    keyword: string
    text: string
  }[]
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

function decodePixels(raw: Uint8Array, width: number, height: number) {
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
  return pixels
}

function decodeCompressedText(data: Uint8Array, offset: number): string {
  if (data[offset] !== 0) throw new Error('invalid text compression method')
  return inflateSync(data.subarray(offset + 1)).toString('latin1')
}

function decodeInternationalText(data: Uint8Array, offset: number): string {
  const compressed = data[offset]
  if ((compressed !== 0 && compressed !== 1) || data[offset + 1] !== 0)
    throw new Error('invalid international text compression')
  const languageEnd = data.indexOf(0, offset + 2)
  const translatedEnd = data.indexOf(0, languageEnd + 1)
  if (languageEnd < 0 || translatedEnd < 0)
    throw new Error('invalid international text header')
  const text = data.subarray(translatedEnd + 1)
  return (compressed ? inflateSync(text) : Buffer.from(text)).toString('utf8')
}

function decodeText(
  type: 'tEXt' | 'zTXt' | 'iTXt',
  data: Uint8Array
): DecodedPng['textChunks'][number] {
  const separator = data.indexOf(0)
  if (separator < 1) throw new Error('missing text keyword')
  const keyword = Buffer.from(data.subarray(0, separator)).toString('latin1')
  const offset = separator + 1
  const text =
    type === 'tEXt'
      ? Buffer.from(data.subarray(offset)).toString('latin1')
      : type === 'zTXt'
        ? decodeCompressedText(data, offset)
        : decodeInternationalText(data, offset)
  return { type, keyword, text }
}

function decodeHeader(data: Uint8Array) {
  if (data[8] !== 8) throw new Error(`unsupported bit depth ${data[8]}`)
  if (data[9] !== 6) throw new Error(`unsupported color type ${data[9]}`)
  return { width: readU32be(data, 0), height: readU32be(data, 4) }
}

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
  const textChunks: DecodedPng['textChunks'] = []

  while (offset < bytes.length) {
    const length = readU32be(bytes, offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (
      crc32(bytes.subarray(offset + 4, offset + 8 + length)) !==
      readU32be(bytes, offset + 8 + length)
    )
      throw new Error(`invalid ${type} checksum`)

    if (type === 'IEND') break
    if (type === 'IHDR') {
      const header = decodeHeader(data)
      width = header.width
      height = header.height
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      textChunks.push(decodeText(type, data))
    }

    offset += 8 + length + 4
  }

  const raw = inflateSync(Buffer.concat(idatParts))

  const pixels = decodePixels(raw, width, height)

  return { width, height, pixels, textChunks }
}
