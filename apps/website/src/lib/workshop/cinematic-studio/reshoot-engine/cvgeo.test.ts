import { describe, expect, it } from 'vitest'

import { readGeometry } from './cvgeo'

const encoder = new TextEncoder()

interface FixtureOptions {
  readonly headerLengthDelta?: number
  readonly jpegLength?: number
  readonly depthLengthDelta?: number
  readonly shape?: [number, number, number]
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function fixture({
  headerLengthDelta = 0,
  jpegLength = 1,
  depthLengthDelta = 0,
  shape = [1, 1, 1]
}: FixtureOptions = {}): Promise<ArrayBuffer> {
  const jpeg = Uint8Array.of(0xff)
  const compressed = await deflate(Uint8Array.of(0x00, 0x3c))
  const header = encoder.encode(
    JSON.stringify({
      version: 1,
      frames: 1,
      width: 1,
      height: 1,
      fps: 24,
      source_width: 1,
      source_height: 1,
      fx_norm: null,
      jpegs: [{ offset: 0, length: jpegLength }],
      depth: {
        offset: jpeg.length,
        length: compressed.length + depthLengthDelta,
        dtype: 'float16',
        shape,
        encoding: 'shuffle2+zlib'
      }
    })
  )
  const output = new Uint8Array(
    12 + header.length + jpeg.length + compressed.length
  )
  output.set(encoder.encode('CVGEO1\0\0'))
  new DataView(output.buffer).setUint32(
    8,
    header.length + headerLengthDelta,
    true
  )
  output.set(header, 12)
  output.set(jpeg, 12 + header.length)
  output.set(compressed, 12 + header.length + jpeg.length)
  return output.buffer
}

describe('CrossView geometry reader', () => {
  it('reads bounded JPEG and depth data', async () => {
    const geometry = await readGeometry(await fixture())
    expect(geometry).toMatchObject({ frames: 1, width: 1, height: 1 })
    expect(geometry.jpegs).toHaveLength(1)
    expect(geometry.depth[0][0]).toBe(1)
  })

  it.for<{
    name: string
    options: FixtureOptions
    message: string
  }>([
    {
      name: 'truncated header',
      options: { headerLengthDelta: 1_000 },
      message: 'Truncated CrossView geometry header.'
    },
    {
      name: 'out-of-bounds JPEG',
      options: { jpegLength: 1_000 },
      message: 'JPEG data is out of bounds.'
    },
    {
      name: 'out-of-bounds depth',
      options: { depthLengthDelta: 1_000 },
      message: 'Depth data is out of bounds.'
    },
    {
      name: 'mismatched depth shape',
      options: { shape: [1, 1, 2] },
      message: 'Depth data does not match its declared shape.'
    },
    {
      name: 'unsafe depth shape',
      options: { shape: [Number.MAX_SAFE_INTEGER, 2, 1] },
      message: 'Depth data does not match its declared shape.'
    }
  ])('rejects $name', async ({ options, message }) => {
    await expect(readGeometry(await fixture(options))).rejects.toThrow(message)
  })
})
