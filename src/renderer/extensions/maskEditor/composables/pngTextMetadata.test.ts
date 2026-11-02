import { crc32, deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { decodePng } from '@/utils/__fixtures__/decodePng'
import { encodeRgbaAsPng } from '@/utils/pngEncodeUtil'
import { copyPngTextMetadata } from './pngTextMetadata'

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  bytes.set(new TextEncoder().encode(type), 4)
  bytes.set(data, 8)
  view.setUint32(data.length + 8, crc32(bytes.subarray(4, data.length + 8)))
  return bytes
}

async function pixelImage(color: number): Promise<Blob> {
  return encodeRgbaAsPng({
    data: new Uint8ClampedArray([color, 20, 30, 0]),
    width: 1,
    height: 1
  })
}

const textChunks = [
  chunk('tEXt', new TextEncoder().encode('prompt\0original prompt')),
  chunk(
    'zTXt',
    Buffer.concat([
      Buffer.from('workflow\0\0'),
      deflateSync('compressed workflow')
    ])
  ),
  chunk('iTXt', new TextEncoder().encode('parameters\0\0\0\0\0中文提示词'))
]

describe('copyPngTextMetadata', () => {
  it.for(textChunks)(
    'retains text chunks without restoring the original pixels',
    async (textChunk) => {
      const original = await pixelImage(100)
      const source = await new Blob([
        original.slice(0, 33),
        textChunk,
        original.slice(33)
      ]).arrayBuffer()
      const edited = await pixelImage(200)

      const result = copyPngTextMetadata(source, edited)

      expect(result).not.toBeNull()
      const bytes = new Uint8Array(await result!.arrayBuffer())
      expect(bytes.subarray(33, 33 + textChunk.length)).toEqual(textChunk)
      expect(Array.from(decodePng(bytes).pixels)).toEqual([200, 20, 30, 0])
    }
  )

  it('copies multiple text chunks from either side of IDAT, excluding color information', async () => {
    const original = await pixelImage(100)
    const source = await new Blob([
      original.slice(0, 33),
      textChunks[0],
      chunk('gAMA', new Uint8Array([0, 0, 177, 143])),
      original.slice(33, -12),
      ...textChunks.slice(1),
      original.slice(-12)
    ]).arrayBuffer()
    const edited = await pixelImage(200)

    const result = copyPngTextMetadata(source, edited)

    const expected = new Blob([
      edited.slice(0, 33),
      ...textChunks,
      edited.slice(33)
    ])
    expect(await result!.arrayBuffer()).toEqual(await expected.arrayBuffer())
  })

  it('keeps images with no PNG text metadata unchanged', async () => {
    const image = await pixelImage(200)
    expect(copyPngTextMetadata(await image.arrayBuffer(), image)).toBe(image)
    expect(
      copyPngTextMetadata(new Uint8Array([255, 216, 255]).buffer, image)
    ).toBe(image)
  })

  it.for([8, 16, 32, 40])(
    'rejects a PNG truncated at byte %s',
    async (size) => {
      const image = await pixelImage(200)
      const source = await image.slice(0, size).arrayBuffer()
      expect(copyPngTextMetadata(source, image)).toBeNull()
    }
  )
})
