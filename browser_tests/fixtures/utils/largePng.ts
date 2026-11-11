import { crc32, deflateSync } from 'node:zlib'

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** Encodes a noisy RGB gradient PNG whose size and entropy resemble a real upscaled output. */
export function createLargePng(
  width: number,
  height: number,
  seed = 1
): Buffer {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  let state = seed
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < width; x++) {
      state = (state * 1103515245 + 12345) >>> 0
      const noise = (state >>> 24) & 0x1f
      const offset = y * stride + 1 + x * 3
      raw[offset] = ((x * 255) / width + noise) & 0xff
      raw[offset + 1] = ((y * 255) / height + noise) & 0xff
      raw[offset + 2] = (seed * 37 + noise * 3) & 0xff
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}
