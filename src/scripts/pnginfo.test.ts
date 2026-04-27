import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getLatentMetadata, getWebpMetadata } from './pnginfo'

afterEach(() => vi.restoreAllMocks())

const fixturesDir = path.resolve(__dirname, 'metadata/__fixtures__')

type AsciiIfdEntry = { tag: number; value: string }

function encodeAsciiIfd(entries: AsciiIfdEntry[]): Uint8Array {
  const tableSize = 10 + 12 * entries.length
  const strings = entries.map((e) => new TextEncoder().encode(`${e.value}\0`))
  const totalStringBytes = strings.reduce((sum, s) => sum + s.length, 0)

  const buf = new Uint8Array(tableSize + totalStringBytes)
  const dv = new DataView(buf.buffer)

  buf.set([0x49, 0x49], 0)
  dv.setUint16(2, 0x002a, true)
  dv.setUint32(4, 8, true)
  dv.setUint16(8, entries.length, true)

  let stringOffset = tableSize
  for (let i = 0; i < entries.length; i++) {
    const entryOffset = 10 + i * 12
    dv.setUint16(entryOffset, entries[i].tag, true)
    dv.setUint16(entryOffset + 2, 2, true)
    dv.setUint32(entryOffset + 4, strings[i].length, true)
    dv.setUint32(entryOffset + 8, stringOffset, true)
    buf.set(strings[i], stringOffset)
    stringOffset += strings[i].length
  }

  return buf
}

type WebpChunk = { type: string; payload: Uint8Array }

function wrapInWebp(chunks: WebpChunk[]): File {
  let payloadSize = 0
  for (const c of chunks) {
    payloadSize += 8 + c.payload.length + (c.payload.length % 2)
  }
  const totalSize = 12 + payloadSize
  const buf = new Uint8Array(totalSize)
  const dv = new DataView(buf.buffer)

  buf.set([0x52, 0x49, 0x46, 0x46], 0)
  dv.setUint32(4, totalSize - 8, true)
  buf.set([0x57, 0x45, 0x42, 0x50], 8)

  let offset = 12
  for (const c of chunks) {
    for (let i = 0; i < 4; i++) {
      buf[offset + i] = c.type.charCodeAt(i)
    }
    dv.setUint32(offset + 4, c.payload.length, true)
    buf.set(c.payload, offset + 8)
    offset += 8 + c.payload.length + (c.payload.length % 2)
  }

  return new File([buf], 'test.webp', { type: 'image/webp' })
}

function exifChunk(
  entries: AsciiIfdEntry[],
  options: { withExifPrefix?: boolean } = {}
): WebpChunk {
  const ifd = encodeAsciiIfd(entries)
  if (!options.withExifPrefix) {
    return { type: 'EXIF', payload: ifd }
  }
  const prefixed = new Uint8Array(6 + ifd.length)
  prefixed.set(new TextEncoder().encode('Exif\0\0'), 0)
  prefixed.set(ifd, 6)
  return { type: 'EXIF', payload: prefixed }
}

describe('getWebpMetadata', () => {
  it('returns empty when the file is not a valid WEBP', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File([new Uint8Array(12)], 'fake.webp')

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({})
    expect(console.error).toHaveBeenCalledWith('Not a valid WEBP file')
  })

  it('returns empty when a valid WEBP has no EXIF chunk', async () => {
    const file = wrapInWebp([
      { type: 'VP8 ', payload: new Uint8Array([0, 0, 0, 0]) }
    ])

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({})
  })

  it('extracts workflow and prompt from EXIF without prefix', async () => {
    const bytes = fs.readFileSync(path.join(fixturesDir, 'with_metadata.webp'))
    const file = new File([bytes], 'test.webp', { type: 'image/webp' })

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({
      workflow:
        '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}',
      prompt: '{"1":{"class_type":"KSampler","inputs":{}}}'
    })
  })

  it('extracts workflow and prompt from EXIF with Exif\\0\\0 prefix', async () => {
    const bytes = fs.readFileSync(
      path.join(fixturesDir, 'with_metadata_exif_prefix.webp')
    )
    const file = new File([bytes], 'test.webp', { type: 'image/webp' })

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({
      workflow:
        '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}',
      prompt: '{"1":{"class_type":"KSampler","inputs":{}}}'
    })
  })

  it('walks past odd-length preceding chunks (RIFF padding)', async () => {
    const file = wrapInWebp([
      { type: 'VP8 ', payload: new Uint8Array(3) },
      exifChunk([{ tag: 0, value: 'workflow:{"a":1}' }])
    ])

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({ workflow: '{"a":1}' })
  })
})

describe('getLatentMetadata', () => {
  function buildSafetensors(headerObj: object): File {
    const headerBytes = new TextEncoder().encode(JSON.stringify(headerObj))
    const buf = new Uint8Array(8 + headerBytes.length)
    const dv = new DataView(buf.buffer)
    dv.setUint32(0, headerBytes.length, true)
    dv.setUint32(4, 0, true)
    buf.set(headerBytes, 8)
    return new File([buf], 'test.safetensors')
  }

  it('extracts __metadata__ from a safetensors header', async () => {
    const workflow =
      '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}'
    const prompt = '{"1":{"class_type":"KSampler","inputs":{}}}'
    const file = buildSafetensors({
      __metadata__: { workflow, prompt },
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const metadata = await getLatentMetadata(file)

    expect(metadata).toEqual({ workflow, prompt })
  })

  it('returns undefined when the safetensors header has no __metadata__', async () => {
    const file = buildSafetensors({
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const metadata = await getLatentMetadata(file)

    expect(metadata).toBeUndefined()
  })

  it('returns undefined for a truncated or malformed file', async () => {
    const file = new File([new Uint8Array(4)], 'bad.safetensors')

    const metadata = await getLatentMetadata(file)

    expect(metadata).toBeUndefined()
  })
})
