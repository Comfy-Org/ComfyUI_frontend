import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { api } from './api'
import { getFromAvifFile } from './metadata/avif'
import { getFromFlacFile } from './metadata/flac'
import { getFromPngFile } from './metadata/png'
import {
  getAvifMetadata,
  getFlacMetadata,
  getLatentMetadata,
  getPngMetadata,
  getWebpMetadata,
  importA1111
} from './pnginfo'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  api: {
    getEmbeddings: vi.fn()
  }
}))

vi.mock('./metadata/png', () => ({
  getFromPngFile: vi.fn()
}))
vi.mock('./metadata/flac', () => ({
  getFromFlacFile: vi.fn()
}))
vi.mock('./metadata/avif', () => ({
  getFromAvifFile: vi.fn()
}))

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

describe('format-specific metadata wrappers', () => {
  it('getPngMetadata delegates to getFromPngFile', async () => {
    const file = new File([], 'a.png', { type: 'image/png' })
    vi.mocked(getFromPngFile).mockResolvedValue({ workflow: '{"png":1}' })

    const result = await getPngMetadata(file)

    expect(getFromPngFile).toHaveBeenCalledWith(file)
    expect(result).toEqual({ workflow: '{"png":1}' })
  })

  it('getFlacMetadata delegates to getFromFlacFile', async () => {
    const file = new File([], 'a.flac', { type: 'audio/flac' })
    vi.mocked(getFromFlacFile).mockResolvedValue({ workflow: '{"flac":1}' })

    const result = await getFlacMetadata(file)

    expect(getFromFlacFile).toHaveBeenCalledWith(file)
    expect(result).toEqual({ workflow: '{"flac":1}' })
  })

  it('getAvifMetadata delegates to getFromAvifFile', async () => {
    const file = new File([], 'a.avif', { type: 'image/avif' })
    vi.mocked(getFromAvifFile).mockResolvedValue({ workflow: '{"avif":1}' })

    const result = await getAvifMetadata(file)

    expect(getFromAvifFile).toHaveBeenCalledWith(file)
    expect(result).toEqual({ workflow: '{"avif":1}' })
  })
})

describe('importA1111', () => {
  const parameters =
    'positive\nNegative prompt: negative\nSteps: 20, Sampler: Euler, CFG scale: 7, Seed: 1, Size: 512x512, Model: model.safetensors'
  const parametersWithoutNegativePrompt =
    'positive\nSteps: 20, Sampler: Euler, CFG scale: 7, Seed: 1, Size: 512x512, Model: model.safetensors'

  function mockAvailableCoreNodes(graph: LGraph) {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(graph, 'arrange').mockImplementation(() => {})
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      const node = new LGraphNode(type, type)
      if (type === 'CLIPTextEncode') {
        node.addWidget('text', 'text', '', () => {})
      }
      vi.spyOn(node, 'connect').mockReturnValue(null)
      return node
    })
  }

  it.each([
    ['has no steps', 'positive'],
    ['has no options', 'positive\nNegative prompt: negative\nSteps:']
  ])('does not load embeddings when parameters %s', async (_case, input) => {
    const graph = new LGraph()
    const beforeGraphClear = vi.fn()
    vi.mocked(api.getEmbeddings).mockRejectedValue(
      new TypeError('Failed to fetch')
    )

    const imported = await importA1111(graph, input, beforeGraphClear)

    expect(imported).toBe('not-a1111')
    expect(api.getEmbeddings).not.toHaveBeenCalled()
    expect(beforeGraphClear).not.toHaveBeenCalled()
  })

  it('returns core-nodes-unavailable without clearing the graph', async () => {
    const graph = new LGraph()
    const clear = vi.spyOn(graph, 'clear')
    const beforeGraphClear = vi.fn()
    vi.mocked(api.getEmbeddings).mockRejectedValue(
      new TypeError('Failed to fetch')
    )
    vi.spyOn(LiteGraph, 'createNode').mockReturnValue(null)

    const imported = await importA1111(graph, parameters, beforeGraphClear)

    expect(imported).toBe('core-nodes-unavailable')
    expect(api.getEmbeddings).not.toHaveBeenCalled()
    expect(beforeGraphClear).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })

  it('imports without embedding substitution when loading embeddings fails', async () => {
    const graph = new LGraph()
    const clear = vi.spyOn(graph, 'clear')
    const beforeGraphClear = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(api.getEmbeddings).mockRejectedValue(
      new TypeError('Failed to fetch')
    )
    mockAvailableCoreNodes(graph)

    const imported = await importA1111(graph, parameters, beforeGraphClear)

    expect(imported).toBe('imported-without-embeddings')
    expect(beforeGraphClear).toHaveBeenCalledOnce()
    expect(clear).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load embeddings for A1111 import:',
      expect.any(TypeError)
    )
  })

  it('awaits the pre-clear hook before mutating the graph', async () => {
    const graph = new LGraph()
    const clear = vi.spyOn(graph, 'clear')
    vi.mocked(api.getEmbeddings).mockResolvedValue([])
    mockAvailableCoreNodes(graph)
    let release: (() => void) | undefined
    const beforeGraphClear = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    const imported = importA1111(graph, parameters, beforeGraphClear)
    await vi.waitFor(() => expect(beforeGraphClear).toHaveBeenCalledOnce())
    expect(clear).not.toHaveBeenCalled()

    release?.()
    await expect(imported).resolves.toBe('imported')
    expect(clear).toHaveBeenCalledOnce()
  })

  it.each([
    ['with a negative prompt', parameters, 'negative'],
    ['without a negative prompt', parametersWithoutNegativePrompt, '']
  ])('imports parameters %s', async (_case, input, expectedNegativePrompt) => {
    const graph = new LGraph()
    const clear = vi.spyOn(graph, 'clear')
    const beforeGraphClear = vi.fn()
    vi.mocked(api.getEmbeddings).mockResolvedValue([])
    mockAvailableCoreNodes(graph)

    const imported = await importA1111(graph, input, beforeGraphClear)

    expect(imported).toBe('imported')
    expect(beforeGraphClear).toHaveBeenCalledOnce()
    expect(beforeGraphClear.mock.invocationCallOrder[0]).toBeLessThan(
      clear.mock.invocationCallOrder[0]
    )
    expect(
      vi
        .mocked(LiteGraph.createNode)
        .mock.results.map(({ value }) => value)
        .filter((node) => node?.type === 'CLIPTextEncode')
        .map((node) => node?.widgets?.[0].value)
    ).toEqual(['positive', expectedNegativePrompt])
  })

  it('prefixes known embedding names in prompts', async () => {
    const graph = new LGraph()
    vi.mocked(api.getEmbeddings).mockResolvedValue(['easynegative'])
    mockAvailableCoreNodes(graph)

    const imported = await importA1111(
      graph,
      'masterpiece\nNegative prompt: EasyNegative, blurry\nSteps: 20'
    )

    expect(imported).toBe('imported')
    expect(
      vi
        .mocked(LiteGraph.createNode)
        .mock.results.map(({ value }) => value)
        .filter((node) => node?.type === 'CLIPTextEncode')
        .map((node) => node?.widgets?.[0].value)
    ).toEqual(['masterpiece', 'embedding:EasyNegative, blurry'])
  })
})
