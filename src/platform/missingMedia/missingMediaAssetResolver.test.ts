import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as AssetServiceModule from '@/platform/assets/services/assetService'
import type * as FetchJobsModule from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  getAssetDetectionNames,
  resolveMissingMediaAssetSources
} from './missingMediaAssetResolver'

const mockInputItems = ref<AssetItem[]>([])
const mockInputHasMore = ref(false)

const { mockUseAssetsQuery } = vi.hoisted(() => ({
  mockUseAssetsQuery: vi.fn()
}))

const { mockGetAssetsPageByTag } = vi.hoisted(() => ({
  mockGetAssetsPageByTag: vi.fn()
}))

const { mockFetchHistoryPage } = vi.hoisted(() => ({
  mockFetchHistoryPage: vi.fn()
}))

vi.mock('@/platform/assets/composables/useAssetsQuery', () => ({
  useAssetsQuery: mockUseAssetsQuery,
  invalidateAll: vi.fn()
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { assetsEnabled: true } })
}))

vi.mock('@/platform/assets/services/assetService', async () => {
  const actual = await vi.importActual<typeof AssetServiceModule>(
    '@/platform/assets/services/assetService'
  )

  return {
    ...actual,
    assetService: {
      ...actual.assetService,
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

function makeAsset(name: string, assetHash?: string): AssetItem {
  return fromPartial({
    id: name,
    name,
    hash: assetHash,
    tags: ['input']
  })
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
    mockInputItems.value = []
    mockInputHasMore.value = false
    mockUseAssetsQuery.mockReturnValue({
      items: mockInputItems,
      hasMore: mockInputHasMore,
      loadMore: vi.fn(() => {
        mockInputHasMore.value = false
        return Promise.resolve()
      })
    })
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([]))
    mockFetchHistoryPage.mockResolvedValue(makeHistoryPage([]))
  })

  it('loads cloud input assets via a public-inclusive query', async () => {
    const inputAsset = makeAsset('photo.png')
    mockInputItems.value = [inputAsset]

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: false,
      generatedMatchNames: new Set(),
      allowCompactSuffix: true
    })

    expect(mockUseAssetsQuery).toHaveBeenCalledWith({
      include_tags: ['input'],
      include_public: true
    })
    expect(result.inputAssets).toEqual([inputAsset])
    expect(result.generatedAssets).toEqual([])
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
    const outputAsset = makeAsset('ComfyUI_00001_.png', target)
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([outputAsset], {
        hasMore: true,
        total: 501
      })
    )

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([outputAsset])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()
  })

  it('stops reading cloud output asset pages when a flat target matches by name', async () => {
    const target = 'ComfyUI_00001_.mp4'
    const outputAsset = makeAsset(target, 'different-output-hash.mp4')
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([outputAsset], {
        hasMore: true,
        total: 501
      })
    )

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([outputAsset])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()
  })

  it('does not stop cloud output asset paging on a flat asset name collision', async () => {
    const target = 'target-output.mp4'
    const collidingNameAsset = makeAsset(target)
    const matchingHashAsset = makeAsset('ComfyUI_00001_.mp4', target)
    mockGetAssetsPageByTag
      .mockResolvedValueOnce(
        makeAssetPage([collidingNameAsset], { hasMore: true, total: 501 })
      )
      .mockResolvedValueOnce(makeAssetPage([matchingHashAsset]))

    const result = await resolveMissingMediaAssetSources({
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      generatedHashRequiredNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([
      collidingNameAsset,
      matchingHashAsset
    ])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledTimes(2)
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
