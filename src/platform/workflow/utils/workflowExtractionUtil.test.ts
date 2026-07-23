import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('@/services/jobOutputCache', () => ({
  getJobWorkflow: vi.fn(),
  getJobApiPrompt: vi.fn()
}))
vi.mock('@/platform/assets/utils/assetUrlUtil', () => ({
  getAssetUrl: vi.fn()
}))
vi.mock('@/scripts/metadata/parser', () => ({
  getWorkflowDataFromFile: vi.fn()
}))
vi.mock('@/platform/assets/schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: vi.fn()
}))

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import { blankGraph } from '@/scripts/defaultGraph'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { getJobApiPrompt, getJobWorkflow } from '@/services/jobOutputCache'

import {
  extractApiPromptFromAsset,
  extractWorkflowFromAsset,
  supportsWorkflowMetadata
} from './workflowExtractionUtil'

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'image.png',
    tags: [],
    ...overrides
  }
}

const jobMetadata = { jobId: 'job-42', nodeId: 0, subfolder: '' }

function mockFetchOk(blob: Blob): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
  )
}

describe('extractWorkflowFromAsset', () => {
  beforeEach(() => {
    vi.mocked(getOutputAssetMetadata).mockReturnValue(null)
    vi.mocked(getAssetUrl).mockReturnValue('http://test/asset.png')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('routes output assets through the jobs API', async () => {
    vi.mocked(getOutputAssetMetadata).mockReturnValue(jobMetadata)
    vi.mocked(getJobWorkflow).mockResolvedValue(blankGraph)

    const result = await extractWorkflowFromAsset(
      makeAsset({ user_metadata: jobMetadata })
    )

    expect(getJobWorkflow).toHaveBeenCalledWith('job-42')
    expect(result).toEqual({ workflow: blankGraph, filename: 'image.json' })
  })

  it('returns null workflow when the jobs API resolves nothing', async () => {
    vi.mocked(getOutputAssetMetadata).mockReturnValue(jobMetadata)
    vi.mocked(getJobWorkflow).mockResolvedValue(undefined)

    const result = await extractWorkflowFromAsset(
      makeAsset({ user_metadata: jobMetadata })
    )

    expect(result).toEqual({ workflow: null, filename: 'image.json' })
  })

  it('parses a string workflow from embedded file metadata', async () => {
    mockFetchOk(new Blob(['ignored'], { type: 'image/png' }))
    vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
      workflow: JSON.stringify(blankGraph)
    })

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result.workflow).toEqual(blankGraph)
    expect(result.filename).toBe('image.json')
  })

  it('coerces bare NaN/Infinity in a string workflow to null', async () => {
    mockFetchOk(new Blob(['ignored'], { type: 'image/png' }))
    vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
      workflow:
        '{"last_node_id":1,"last_link_id":0,"version":1,"links":[],"nodes":[{"id":1,"type":"KSampler","widgets_values":[NaN,Infinity]}]}'
    })

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result.workflow).toMatchObject({
      nodes: [{ id: 1, type: 'KSampler', widgets_values: [null, null] }]
    })
  })

  it('passes through an object workflow without re-parsing', async () => {
    mockFetchOk(new Blob(['ignored'], { type: 'image/png' }))
    vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
      workflow: blankGraph
    })

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result.workflow).toBe(blankGraph)
  })

  it('returns null workflow when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result).toEqual({ workflow: null, filename: 'image.json' })
    expect(getWorkflowDataFromFile).not.toHaveBeenCalled()
  })

  it('returns null workflow when the file has no embedded workflow', async () => {
    mockFetchOk(new Blob(['ignored'], { type: 'image/png' }))
    vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result).toEqual({ workflow: null, filename: 'image.json' })
  })

  it('swallows errors during extraction and logs them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await extractWorkflowFromAsset(makeAsset())

    expect(result).toEqual({ workflow: null, filename: 'image.json' })
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to extract workflow from asset:',
      expect.any(Error)
    )
  })

  it('strips the original extension when computing the .json filename', async () => {
    mockFetchOk(new Blob(['ignored'], { type: 'image/webp' }))
    vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

    const result = await extractWorkflowFromAsset(
      makeAsset({ name: 'foo.webp' })
    )

    expect(result.filename).toBe('foo.json')
  })
})

describe('extractApiPromptFromAsset', () => {
  const apiPrompt = { '1': { class_type: 'KSampler', inputs: {} } }

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns the stored API graph for an output asset', async () => {
    vi.mocked(getOutputAssetMetadata).mockReturnValue(jobMetadata)
    vi.mocked(getJobApiPrompt).mockResolvedValue(apiPrompt)

    await expect(extractApiPromptFromAsset(makeAsset())).resolves.toEqual(
      apiPrompt
    )
    expect(getJobApiPrompt).toHaveBeenCalledWith('job-42')
  })

  it('returns undefined for assets with no job', async () => {
    vi.mocked(getOutputAssetMetadata).mockReturnValue(null)

    await expect(
      extractApiPromptFromAsset(makeAsset())
    ).resolves.toBeUndefined()
    expect(getJobApiPrompt).not.toHaveBeenCalled()
  })
})

describe('supportsWorkflowMetadata', () => {
  it.for([
    ['image.png', true],
    ['image.PNG', true],
    ['image.webp', true],
    ['audio.flac', true],
    ['workflow.json', true],
    ['image.jpg', false],
    ['image.gif', false],
    ['no-extension', false]
  ] as const)('returns %s for %s', ([filename, expected]) => {
    expect(supportsWorkflowMetadata(filename)).toBe(expected)
  })
})
