import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { api } from '@/scripts/api'
import { getFromAvifFile } from './metadata/avif'
import { getFromFlacFile } from './metadata/flac'
import { getFromPngFile } from './metadata/png'
import {
  getAvifMetadata,
  getFlacMetadata,
  importA1111,
  getLatentMetadata,
  getPngMetadata,
  getWebpMetadata
} from './pnginfo'

vi.mock('./metadata/png', () => ({
  getFromPngFile: vi.fn()
}))
vi.mock('./metadata/flac', () => ({
  getFromFlacFile: vi.fn()
}))
vi.mock('./metadata/avif', () => ({
  getFromAvifFile: vi.fn()
}))

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

function encodeNonAsciiIfdEntry(tag: number): Uint8Array {
  const buf = new Uint8Array(22)
  const dv = new DataView(buf.buffer)
  buf.set([0x49, 0x49], 0)
  dv.setUint16(2, 0x002a, true)
  dv.setUint32(4, 8, true)
  dv.setUint16(8, 1, true)
  dv.setUint16(10, tag, true)
  dv.setUint16(12, 3, true)
  dv.setUint32(14, 1, true)
  dv.setUint32(18, 123, true)
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

  it('ignores EXIF entries that are not ASCII strings', async () => {
    const file = wrapInWebp([
      { type: 'EXIF', payload: encodeNonAsciiIfdEntry(270) }
    ])

    const metadata = await getWebpMetadata(file)

    expect(metadata).toEqual({})
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
  function widget(
    name: string,
    options: string[] = []
  ): IBaseWidget & { value?: string | number } {
    return fromPartial<IBaseWidget & { value?: string | number }>({
      name,
      options: { values: options },
      value: undefined
    })
  }

  function createNode(type: string): LGraphNode {
    const widgetsByType: Record<string, IBaseWidget[]> = {
      CheckpointLoaderSimple: [widget('ckpt_name', ['sd15.safetensors'])],
      CLIPSetLastLayer: [widget('stop_at_clip_layer')],
      CLIPTextEncode: [widget('text')],
      EmptyLatentImage: [widget('width'), widget('height')],
      ImageScale: [widget('width'), widget('height')],
      ImageUpscaleWithModel: [],
      KSampler: [
        widget('cfg'),
        widget('sampler_name', ['euler_a', 'dpmpp_2m']),
        widget('scheduler', ['normal', 'karras']),
        widget('seed'),
        widget('steps'),
        widget('denoise')
      ],
      LatentUpscale: [
        widget('upscale_method', ['nearest-exact']),
        widget('width'),
        widget('height')
      ],
      LoraLoader: [
        widget('lora_name', ['foo.safetensors']),
        widget('strength_model'),
        widget('strength_clip')
      ],
      UpscaleModelLoader: [widget('model_name', ['ESRGAN'])],
      VAEEncodeTiled: [],
      VAEDecodeTiled: [],
      SaveImage: [],
      VAEDecode: []
    }
    return {
      type,
      widgets: widgetsByType[type] ?? [],
      connect: vi.fn()
    } as unknown as LGraphNode
  }

  function createGraph(): LGraph {
    return fromPartial<LGraph>({
      add: vi.fn(),
      arrange: vi.fn(),
      clear: vi.fn()
    })
  }

  function findWidget(node: LGraphNode, name: string) {
    return node.widgets?.find((widget) => widget.name === name)
  }

  it('ignores text without parsed generation settings', async () => {
    const graph = createGraph()
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])

    await importA1111(graph, 'positive prompt only')
    await importA1111(graph, 'positive prompt\nSteps:\n')

    expect(graph.clear).not.toHaveBeenCalled()
  })

  it('ignores text without a negative prompt section', async () => {
    const graph = createGraph()
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])

    await importA1111(
      graph,
      ['positive prompt only', 'Steps: 20, Sampler: Euler a'].join('\n')
    )

    expect(graph.clear).not.toHaveBeenCalled()
  })

  it('stops when a required base node cannot be created', async () => {
    const graph = createGraph()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) =>
      type === 'KSampler' ? null : createNode(type)
    )

    await importA1111(
      graph,
      [
        'prompt',
        'Negative prompt: blurry',
        'Steps: 20, Sampler: Euler a, Size: 512x512'
      ].join('\n')
    )

    expect(graph.clear).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      'Failed to create required nodes for A1111 import'
    )
  })

  it('builds a basic graph from A1111 parameters', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue(['easynegative'])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        '<lora:foo:0.7> portrait easynegative',
        'Negative prompt: blurry <lora:bad:not-number>',
        'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 42, Size: 512x512, Model: sd15, Clip skip: 2, Model hash: ignored'
      ].join('\n')
    )

    const checkpoint = nodes.find(
      (node) => node.type === 'CheckpointLoaderSimple'
    )
    const clipSkip = nodes.find((node) => node.type === 'CLIPSetLastLayer')
    const sampler = nodes.find((node) => node.type === 'KSampler')
    const image = nodes.find((node) => node.type === 'EmptyLatentImage')
    const lora = nodes.find((node) => node.type === 'LoraLoader')
    const textNodes = nodes.filter((node) => node.type === 'CLIPTextEncode')

    expect(graph.clear).toHaveBeenCalledOnce()
    expect(graph.arrange).toHaveBeenCalledOnce()
    expect(findWidget(checkpoint!, 'ckpt_name')?.value).toBe('sd15.safetensors')
    expect(findWidget(clipSkip!, 'stop_at_clip_layer')?.value).toBe(-2)
    expect(findWidget(sampler!, 'cfg')?.value).toBe(7)
    expect(findWidget(sampler!, 'sampler_name')?.value).toBe('euler_a')
    expect(findWidget(sampler!, 'scheduler')?.value).toBe('normal')
    expect(findWidget(sampler!, 'seed')?.value).toBe(42)
    expect(findWidget(sampler!, 'steps')?.value).toBe(20)
    expect(findWidget(image!, 'width')?.value).toBe(512)
    expect(findWidget(image!, 'height')?.value).toBe(512)
    expect(findWidget(lora!, 'lora_name')?.value).toBe('foo.safetensors')
    expect(findWidget(lora!, 'strength_model')?.value).toBe(0.7)
    expect(findWidget(lora!, 'strength_clip')?.value).toBe(0.7)
    expect(findWidget(textNodes[0], 'text')?.value).toBe(
      ' portrait embedding:easynegative'
    )
    expect(findWidget(textNodes[1], 'text')?.value).toBe('blurry ')
  })

  it('keeps unknown option-prefix values and logs the mismatch', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        'portrait',
        'Negative prompt: blurry',
        'Steps: 20, Sampler: Unknown Sampler, CFG scale: 7, Seed: 42, Size: 512x512, Model: unknown-model'
      ].join('\n')
    )

    const checkpoint = nodes.find(
      (node) => node.type === 'CheckpointLoaderSimple'
    )
    expect(findWidget(checkpoint!, 'ckpt_name')?.value).toBe('unknown-model')
    expect(console.warn).toHaveBeenCalledWith(
      "Unknown value 'unknown-model' for widget 'ckpt_name'",
      checkpoint
    )
  })

  it('skips missing LoraLoader nodes while keeping prompt text cleaned', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      if (type === 'LoraLoader') return null
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        '<lora:missing:0.5> portrait',
        'Negative prompt: blurry',
        'Steps: 20, Sampler: Euler a, Size: 512x512'
      ].join('\n')
    )

    const textNodes = nodes.filter((node) => node.type === 'CLIPTextEncode')
    expect(findWidget(textNodes[0], 'text')?.value).toBe(' portrait')
  })

  it('returns from latent hires setup when LatentUpscale cannot be created', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      if (type === 'LatentUpscale') return null
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        'portrait',
        'Negative prompt: blurry',
        'Steps: 8, Sampler: Euler a, Size: 512x512, Hires upscale: 2, Hires upscaler: Latent'
      ].join('\n')
    )

    expect(nodes.some((node) => node.type === 'KSampler')).toBe(true)
    expect(nodes.some((node) => node.type === 'LatentUpscale')).toBe(false)
  })

  it('builds a latent hires pass with explicit resize and denoise settings', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        'portrait',
        'Negative prompt: blurry',
        'Steps: 12, Sampler: DPM++ 2M Karras, CFG scale: 5, Seed: 1, Size: 513x577, Model: sd15, Hires resize: 1025x1089, Hires steps: 4, Hires upscaler: Latent (nearest-exact), Denoising strength: 0.35'
      ].join('\n')
    )

    const image = nodes.find((node) => node.type === 'EmptyLatentImage')
    const latentUpscale = nodes.find((node) => node.type === 'LatentUpscale')
    const samplers = nodes.filter((node) => node.type === 'KSampler')

    expect(findWidget(image!, 'width')?.value).toBe(576)
    expect(findWidget(image!, 'height')?.value).toBe(640)
    expect(findWidget(latentUpscale!, 'upscale_method')?.value).toBe(
      'nearest-exact'
    )
    expect(findWidget(latentUpscale!, 'width')?.value).toBe(1088)
    expect(findWidget(latentUpscale!, 'height')?.value).toBe(1152)
    expect(findWidget(samplers[0], 'scheduler')?.value).toBe('karras')
    expect(findWidget(samplers[0], 'sampler_name')?.value).toBe('dpmpp_2m')
    expect(findWidget(samplers[1], 'steps')?.value).toBe(4)
    expect(findWidget(samplers[1], 'cfg')?.value).toBe(5)
    expect(findWidget(samplers[1], 'scheduler')?.value).toBe('karras')
    expect(findWidget(samplers[1], 'sampler_name')?.value).toBe('dpmpp_2m')
    expect(findWidget(samplers[1], 'denoise')?.value).toBe(0.35)
  })

  it('builds an image upscaler hires pass with fallback steps and denoise', async () => {
    const graph = createGraph()
    const nodes: LGraphNode[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(api, 'getEmbeddings').mockResolvedValue([])
    vi.spyOn(LiteGraph, 'createNode').mockImplementation((type) => {
      const node = createNode(type)
      nodes.push(node)
      return node
    })

    await importA1111(
      graph,
      [
        'portrait',
        'Negative prompt: blurry',
        'Steps: 8, Sampler: Euler a, CFG scale: 6, Seed: 2, Size: 512x512, Model: sd15, Hires upscale: 1.5, Hires upscaler: ESRGAN'
      ].join('\n')
    )

    const upscaleLoader = nodes.find(
      (node) => node.type === 'UpscaleModelLoader'
    )
    const imageScale = nodes.find((node) => node.type === 'ImageScale')
    const samplers = nodes.filter((node) => node.type === 'KSampler')

    expect(findWidget(upscaleLoader!, 'model_name')?.value).toBe('ESRGAN')
    expect(findWidget(imageScale!, 'width')?.value).toBe(768)
    expect(findWidget(imageScale!, 'height')?.value).toBe(768)
    expect(findWidget(samplers[1], 'steps')?.value).toBe(8)
    expect(findWidget(samplers[1], 'denoise')?.value).toBe(1)
  })
})
