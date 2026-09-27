interface RgbaImage {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[n] = c
}

function crc32(...parts: Uint8Array[]): number {
  let crc = 0xffffffff
  for (const part of parts) {
    for (const byte of part) {
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u32be(value: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ])
}

function pngChunk(
  type: string,
  data: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer>[] {
  const typeBytes = new TextEncoder().encode(type)
  return [u32be(data.length), typeBytes, data, u32be(crc32(typeBytes, data))]
}

async function zlibDeflate(
  bytes: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const compressor = new CompressionStream('deflate')
  const writer = compressor.writable.getWriter()
  const writeDone = writer.write(bytes).then(() => writer.close())

  const chunks: Uint8Array[] = []
  const reader = compressor.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  await writeDone

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Encodes RGBA pixels as a PNG blob without going through a canvas.
 *
 * Canvas 2D output bitmaps use premultiplied alpha: fully transparent pixels
 * lose their RGB the moment they are written to the canvas, and
 * `canvas.toBlob()` serializes that loss. PNG stores straight
 * (non-premultiplied) alpha, so encoding the pixel buffer directly preserves
 * color data under transparent regions.
 */
export async function encodeRgbaAsPng(image: RgbaImage): Promise<Blob> {
  const { width, height, data } = image
  const bytesPerRow = width * 4

  const raw = new Uint8Array(height * (bytesPerRow + 1))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (bytesPerRow + 1)
    raw[rowStart] = 0 // scanline filter: None
    raw.set(data.subarray(y * bytesPerRow, (y + 1) * bytesPerRow), rowStart + 1)
  }

  const ihdr = new Uint8Array(13)
  ihdr.set(u32be(width), 0)
  ihdr.set(u32be(height), 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA (compression/filter/interlace stay 0)

  const idat = await zlibDeflate(raw)

  return new Blob(
    [
      PNG_SIGNATURE,
      ...pngChunk('IHDR', ihdr),
      ...pngChunk('IDAT', idat),
      ...pngChunk('IEND', new Uint8Array(0))
    ],
    { type: 'image/png' }
  )
}
