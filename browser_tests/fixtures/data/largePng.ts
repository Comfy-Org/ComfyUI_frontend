import { encodeRgbaAsPng } from '@/utils/pngEncodeUtil'

export async function createLargePng(
  width: number,
  height: number,
  seed = 1
): Promise<Buffer> {
  const data = new Uint8ClampedArray(width * height * 4)
  let state = seed
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state = (state * 1103515245 + 12345) >>> 0
      const noise = (state >>> 24) & 0x1f
      const offset = (y * width + x) * 4
      data[offset] = ((x * 255) / width + noise) & 0xff
      data[offset + 1] = ((y * 255) / height + noise) & 0xff
      data[offset + 2] = (seed * 37 + noise * 3) & 0xff
      data[offset + 3] = 255
    }
  }
  const png = await encodeRgbaAsPng({ width, height, data })
  return Buffer.from(await png.arrayBuffer())
}
