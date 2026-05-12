import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as AssetServiceModule from '@/platform/assets/services/assetService'
import type * as FetchJobsModule from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  getAssetDetectionNames,
  resolveMissingMediaAssetSources
} from './missingMediaAssetResolver'

const { mockGetInputAssetsIncludingPublic, mockGetAssetsPageByTag } =
  vi.hoisted(() => ({
    mockGetInputAssetsIncludingPublic: vi.fn(),
    mockGetAssetsPageByTag: vi.fn()
  }))

const { mockFetchHistoryPage } = vi.hoisted(() => ({
  mockFetchHistoryPage: vi.fn()
}))

vi.mock('@/platform/assets/services/assetService', async () => {
  const actual = await vi.importActual<typeof AssetServiceModule>(
    '@/platform/assets/services/assetService'
  )

  return {
    ...actual,
    assetService: {
      ...actual.assetService,
      getInputAssetsIncludingPublic: mockGetInputAssetsIncludingPublic,
      getAssetsPageByTag: mockGetAssetsPageByTag
    }
  }
})

vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', async () => {
  const actual = await vi.importActual<typeof FetchJobsModule>(
    '@/platform/remote/comfyui/jobs/fetchJobs'
  )

  return {
    ...actual,
    fetchHistoryPage: mockFetchHistoryPage
  }
})

function makeAsset(name: string, assetHash: string | null = null): AssetItem {
  return {
    id: name,
    name,
    asset_hash: assetHash,
    mime_type: null,
    tags: ['input']
  }
}

function makeHistoryJob(
  filename: string,
  options: { id?: string; subfolder?: string } = {}
): JobListItem {
  return fromAny<JobListItem, unknown>({
    id: options.id ?? filename,
    status: 'completed',
    create_time: 0,
    priority: 0,
    preview_output: {
      filename,
      subfolder: options.subfolder ?? '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    }
  })
}

function makeHistoryPage(
  jobs: JobListItem[],
  options: { offset?: number; hasMore?: boolean; total?: number } = {}
) {
  return {
    jobs,
    total: options.total ?? jobs.length,
    offset: options.offset ?? 0,
    limit: 200,
    hasMore: options.hasMore ?? false
  }
}

function makeAssetPage(
  assets: AssetItem[],
  options: { hasMore?: boolean; total?: number } = {}
) {
  return {
    assets,
    total: options.total ?? assets.length,
    has_more: options.hasMore ?? false
  }
}

describe('resolveMissingMediaAssetSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInputAssetsIncludingPublic.mockResolvedValue([])
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([]))
    mockFetchHistoryPage.mockResolvedValue(makeHistoryPage([]))
  })

  it('loads cloud input assets when requested', async () => {
    const inputAsset = makeAsset('photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValue([inputAsset])

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: false,
      generatedMatchNames: new Set(),
      allowCompactSuffix: true
    })

    expect(result.inputAssets).toEqual([inputAsset])
    expect(result.generatedAssets).toEqual([])
    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
  })

  it('loads cloud output assets by tag when generated candidates need verification', async () => {
    const outputAsset = makeAsset('output.png')
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([outputAsset]))

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['output.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([outputAsset])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledWith(
      'output',
      true,
      expect.objectContaining({
        limit: 500,
        offset: 0,
        signal: expect.any(AbortSignal)
      })
    )
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
  })

  it('stops reading cloud output asset pages once all requested names are found', async () => {
    const target = 'target-output.png'
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([makeAsset(target)], { hasMore: true, total: 501 })
    )

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([makeAsset(target)])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()
  })

  it('aborts cloud output asset loading when input asset loading fails', async () => {
    const inputError = new Error('input failed')
    let rejectInputAssets!: (err: Error) => void
    let resolveOutputAssets!: (page: ReturnType<typeof makeAssetPage>) => void
    mockGetInputAssetsIncludingPublic.mockReturnValueOnce(
      new Promise<AssetItem[]>((_, reject) => {
        rejectInputAssets = reject
      })
    )
    mockGetAssetsPageByTag.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOutputAssets = resolve
      })
    )

    const promise = resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['target.png']),
      allowCompactSuffix: true
    })

    await Promise.resolve()
    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()

    rejectInputAssets(inputError)
    await expect(promise).rejects.toBe(inputError)

    resolveOutputAssets(makeAssetPage([makeAsset('other.png')]))
    await Promise.resolve()

    const outputSignal = mockGetAssetsPageByTag.mock.calls[0]?.[2]?.signal
    expect(outputSignal).toBeInstanceOf(AbortSignal)
    expect(outputSignal.aborted).toBe(true)
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
  })

  it('stops reading generated history once all requested names are found', async () => {
    const target = 'target.png'
    mockFetchHistoryPage.mockResolvedValueOnce(
      makeHistoryPage([makeHistoryJob(target)], {
        hasMore: true,
        total: 400
      })
    )

    const result = await resolveMissingMediaAssetSources({
      isCloud: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toHaveLength(1)
    expect(result.generatedAssets[0].name).toBe(target)
    expect(mockFetchHistoryPage).toHaveBeenCalledOnce()
  })

  it('advances pagination from the requested offset, not the echoed offset', async () => {
    const target = 'target.png'
    mockFetchHistoryPage
      .mockResolvedValueOnce(
        makeHistoryPage(
          Array.from({ length: 200 }, (_, index) =>
            makeHistoryJob(`other-${index}.png`)
          ),
          { offset: 0, hasMore: true, total: 201 }
        )
      )
      .mockResolvedValueOnce(
        makeHistoryPage([makeHistoryJob(target)], {
          offset: 0,
          hasMore: true,
          total: 201
        })
      )

    await resolveMissingMediaAssetSources({
      isCloud: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(mockFetchHistoryPage).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      200,
      0
    )
    expect(mockFetchHistoryPage).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      200,
      200
    )
  })

  it('stops if history reports hasMore but returns an empty page', async () => {
    mockFetchHistoryPage.mockResolvedValueOnce(
      makeHistoryPage([], { hasMore: true, total: 1 })
    )

    const result = await resolveMissingMediaAssetSources({
      isCloud: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['missing.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([])
    expect(mockFetchHistoryPage).toHaveBeenCalledOnce()
  })

  it('stops if history repeats the same job page', async () => {
    const repeatedJob = makeHistoryJob('other.png', { id: 'same-job' })
    mockFetchHistoryPage
      .mockResolvedValueOnce(
        makeHistoryPage([repeatedJob], { hasMore: true, total: 2 })
      )
      .mockResolvedValueOnce(
        makeHistoryPage([repeatedJob], { offset: 1, hasMore: true, total: 2 })
      )

    const result = await resolveMissingMediaAssetSources({
      isCloud: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['missing.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toHaveLength(1)
    expect(mockFetchHistoryPage).toHaveBeenCalledTimes(2)
  })

  it('includes slash and backslash subfolder identifiers for detection', () => {
    const names = getAssetDetectionNames(
      {
        ...makeAsset('child\\photo.png', 'hash.png'),
        user_metadata: { subfolder: 'nested\\folder' }
      },
      { allowCompactSuffix: true }
    )

    expect(names).toEqual(
      expect.arrayContaining([
        'child\\photo.png',
        'hash.png',
        'nested/folder/child/photo.png',
        'nested\\folder\\child\\photo.png'
      ])
    )
    expect(names).not.toContain('nested/folder/hash.png')
    expect(names).not.toContain('nested\\folder\\hash.png')
  })
})
