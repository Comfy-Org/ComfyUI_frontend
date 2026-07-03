import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getFromWebmFile } from '@/scripts/metadata/ebml'
import { getGltfBinaryMetadata } from '@/scripts/metadata/gltf'
import { getFromIsobmffFile } from '@/scripts/metadata/isobmff'
import { getDataFromJSON } from '@/scripts/metadata/json'
import { getMp3Metadata } from '@/scripts/metadata/mp3'
import { getOggMetadata } from '@/scripts/metadata/ogg'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { getSvgMetadata } from '@/scripts/metadata/svg'
import {
  getAvifMetadata,
  getFlacMetadata,
  getLatentMetadata,
  getPngMetadata,
  getWebpMetadata
} from '@/scripts/pnginfo'

vi.mock('@/scripts/metadata/ebml', () => ({ getFromWebmFile: vi.fn() }))
vi.mock('@/scripts/metadata/gltf', () => ({ getGltfBinaryMetadata: vi.fn() }))
vi.mock('@/scripts/metadata/isobmff', () => ({ getFromIsobmffFile: vi.fn() }))
vi.mock('@/scripts/metadata/json', () => ({ getDataFromJSON: vi.fn() }))
vi.mock('@/scripts/metadata/mp3', () => ({ getMp3Metadata: vi.fn() }))
vi.mock('@/scripts/metadata/ogg', () => ({ getOggMetadata: vi.fn() }))
vi.mock('@/scripts/metadata/svg', () => ({ getSvgMetadata: vi.fn() }))
vi.mock('@/scripts/pnginfo', () => ({
  getAvifMetadata: vi.fn(),
  getFlacMetadata: vi.fn(),
  getLatentMetadata: vi.fn(),
  getPngMetadata: vi.fn(),
  getWebpMetadata: vi.fn()
}))

function file(type: string, name = 'file') {
  return new File(['data'], name, { type })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getWorkflowDataFromFile', () => {
  it('routes png/avif/mp3/ogg/webm to their parsers and returns the result', async () => {
    vi.mocked(getPngMetadata).mockResolvedValue({ a: '1' })
    expect(await getWorkflowDataFromFile(file('image/png'))).toEqual({ a: '1' })
    expect(getPngMetadata).toHaveBeenCalled()

    await getWorkflowDataFromFile(file('image/avif'))
    expect(getAvifMetadata).toHaveBeenCalled()

    await getWorkflowDataFromFile(file('audio/mpeg'))
    expect(getMp3Metadata).toHaveBeenCalled()

    await getWorkflowDataFromFile(file('audio/ogg'))
    expect(getOggMetadata).toHaveBeenCalled()

    await getWorkflowDataFromFile(file('video/webm'))
    expect(getFromWebmFile).toHaveBeenCalled()
  })

  it('extracts workflow/prompt from webp, preferring lowercase keys', async () => {
    vi.mocked(getWebpMetadata).mockResolvedValue({
      workflow: 'wf',
      prompt: 'pr'
    })
    expect(await getWorkflowDataFromFile(file('image/webp'))).toEqual({
      workflow: 'wf',
      prompt: 'pr'
    })
  })

  it('falls back to capitalized webp keys when lowercase are absent', async () => {
    vi.mocked(getWebpMetadata).mockResolvedValue({
      Workflow: 'WF',
      Prompt: 'PR'
    })
    expect(await getWorkflowDataFromFile(file('image/webp'))).toEqual({
      workflow: 'WF',
      prompt: 'PR'
    })
  })

  it('handles both flac mime types and extracts workflow/prompt', async () => {
    vi.mocked(getFlacMetadata).mockResolvedValue({ workflow: 'w' })
    expect(await getWorkflowDataFromFile(file('audio/flac'))).toEqual({
      workflow: 'w',
      prompt: undefined
    })
    expect(await getWorkflowDataFromFile(file('audio/x-flac'))).toEqual({
      workflow: 'w',
      prompt: undefined
    })
  })

  it('routes isobmff by mime type and by file extension', async () => {
    await getWorkflowDataFromFile(file('video/mp4'))
    await getWorkflowDataFromFile(file('', 'clip.mov'))
    await getWorkflowDataFromFile(file('', 'clip.m4v'))
    expect(getFromIsobmffFile).toHaveBeenCalledTimes(3)
  })

  it('routes svg and gltf by mime type or extension', async () => {
    await getWorkflowDataFromFile(file('image/svg+xml'))
    await getWorkflowDataFromFile(file('', 'icon.svg'))
    expect(getSvgMetadata).toHaveBeenCalledTimes(2)

    await getWorkflowDataFromFile(file('model/gltf-binary'))
    await getWorkflowDataFromFile(file('', 'model.glb'))
    expect(getGltfBinaryMetadata).toHaveBeenCalledTimes(2)
  })

  it('routes latent/safetensors and json by extension or mime type', async () => {
    await getWorkflowDataFromFile(file('', 'x.latent'))
    await getWorkflowDataFromFile(file('', 'x.safetensors'))
    expect(getLatentMetadata).toHaveBeenCalledTimes(2)

    await getWorkflowDataFromFile(file('application/json'))
    await getWorkflowDataFromFile(file('', 'x.json'))
    expect(getDataFromJSON).toHaveBeenCalledTimes(2)
  })

  it('returns undefined for an unrecognized file', async () => {
    expect(
      await getWorkflowDataFromFile(file('application/zip', 'a.zip'))
    ).toBe(undefined)
  })
})
