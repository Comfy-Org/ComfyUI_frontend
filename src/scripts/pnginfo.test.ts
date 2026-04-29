import { describe, expect, it, vi } from 'vitest'

import { getFromAvifFile } from './metadata/avif'
import { getFromFlacFile } from './metadata/flac'
import { getFromPngFile } from './metadata/png'
import {
  getAvifMetadata,
  getFlacMetadata,
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

function buildExifPayload(workflowJson: string): Uint8Array {
  const fullStr = `workflow:${workflowJson}\0`
  const strBytes = new TextEncoder().encode(fullStr)

  const headerSize = 22
  const buf = new Uint8Array(headerSize + strBytes.length)
  const dv = new DataView(buf.buffer)

  buf.set([0x49, 0x49], 0)
  dv.setUint16(2, 0x002a, true)
  dv.setUint32(4, 8, true)
  dv.setUint16(8, 1, true)
  dv.setUint16(10, 0, true)
  dv.setUint16(12, 2, true)
  dv.setUint32(14, strBytes.length, true)
  dv.setUint32(18, 22, true)
  buf.set(strBytes, 22)

  return buf
}

function buildWebp(precedingChunkLength: number, workflowJson: string): File {
  const exifPayload = buildExifPayload(workflowJson)
  const precedingPadded = precedingChunkLength + (precedingChunkLength % 2)
  const totalSize = 12 + (8 + precedingPadded) + (8 + exifPayload.length)

  const buffer = new Uint8Array(totalSize)
  const dv = new DataView(buffer.buffer)

  buffer.set([0x52, 0x49, 0x46, 0x46], 0)
  dv.setUint32(4, totalSize - 8, true)
  buffer.set([0x57, 0x45, 0x42, 0x50], 8)

  buffer.set([0x56, 0x50, 0x38, 0x20], 12)
  dv.setUint32(16, precedingChunkLength, true)

  const exifStart = 20 + precedingPadded
  buffer.set([0x45, 0x58, 0x49, 0x46], exifStart)
  dv.setUint32(exifStart + 4, exifPayload.length, true)
  buffer.set(exifPayload, exifStart + 8)

  return new File([buffer], 'test.webp', { type: 'image/webp' })
}

describe('getWebpMetadata', () => {
  it('finds workflow when a preceding chunk has odd length (RIFF padding)', async () => {
    const workflow = '{"nodes":[]}'
    const file = buildWebp(3, workflow)

    const metadata = await getWebpMetadata(file)

    expect(metadata.workflow).toBe(workflow)
  })

  it('finds workflow when preceding chunk has even length (no padding)', async () => {
    const workflow = '{"nodes":[1]}'
    const file = buildWebp(4, workflow)

    const metadata = await getWebpMetadata(file)

    expect(metadata.workflow).toBe(workflow)
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

const buildSafetensors = (header: Record<string, unknown>): File => {
  const headerJson = JSON.stringify(header)
  const headerBytes = new TextEncoder().encode(headerJson)
  const buf = new ArrayBuffer(8 + headerBytes.length)
  const dv = new DataView(buf)
  dv.setUint32(0, headerBytes.length, true)
  dv.setUint32(4, 0, true)
  new Uint8Array(buf, 8).set(headerBytes)
  return new File([buf], 'x.safetensors')
}

describe('getLatentMetadata', () => {
  it('returns the __metadata__ object from a safetensors header', async () => {
    const file = buildSafetensors({
      __metadata__: { workflow: '{"nodes":[]}', extra: 'value' },
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const result = await getLatentMetadata(file)

    expect(result).toEqual({ workflow: '{"nodes":[]}', extra: 'value' })
  })

  it('resolves undefined when header has no __metadata__ entry', async () => {
    const file = buildSafetensors({
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const result = await getLatentMetadata(file)

    expect(result).toBeUndefined()
  })
})
