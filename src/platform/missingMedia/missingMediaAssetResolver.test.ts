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

// Mutable holder so each test can flip the runtime `isCloud` to drive the
// resolver's generated-assets oracle selection (Cloud /api/assets vs OSS
// job history). The named-import binding into the resolver re-reads the
// getter on each access (ESM live binding semantics).
const isCloudHolder = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return isCloudHolder.value
  }
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
    isCloudHolder.value = false
    mockGetInputAssetsIncludingPublic.mockResolvedValue([])
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([]))
    mockFetchHistoryPage.mockResolvedValue(makeHistoryPage([]))
  })

  it('loads input assets from the unified listing on both backends', async () => {
    const inputAsset = makeAsset('photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValue([inputAsset])

    const result = await resolveMissingMediaAssetSources({
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
    isCloudHolder.value = true
    const outputAsset = makeAsset('output.png')
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([outputAsset]))

    const result = await resolveMissingMediaAssetSources({
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
    isCloudHolder.value = true
    const target = 'target-output.png'
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([makeAsset(target)], { hasMore: true, total: 501 })
    )

    const result = await resolveMissingMediaAssetSources({
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([makeAsset(target)])
    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()
  })

  it('returns empty inputAssets and keeps generated fetch alive when input fails (soft degrade)', async () => {
    isCloudHolder.value = true
    const inputError = new Error('GET /api/assets 404')
    mockGetInputAssetsIncludingPublic.mockRejectedValueOnce(inputError)
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([makeAsset('survivor.png')])
    )

    const result = await resolveMissingMediaAssetSources({
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['survivor.png']),
      allowCompactSuffix: true
    })

    // Input oracle failed: degrade to empty. Generated oracle is independent
    // and must keep running so output candidates can still verify.
    expect(result.inputAssets).toEqual([])
    expect(result.generatedAssets).toEqual([makeAsset('survivor.png')])
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
  })

  it('returns empty generatedAssets when history fetch fails but inputs succeed', async () => {
    const inputAsset = makeAsset('local-photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValueOnce([inputAsset])
    mockFetchHistoryPage.mockRejectedValueOnce(new Error('500 history'))

    const result = await resolveMissingMediaAssetSources({
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['rendered.png']),
      allowCompactSuffix: true
    })

    expect(result.inputAssets).toEqual([inputAsset])
    expect(result.generatedAssets).toEqual([])
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
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['missing.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toHaveLength(1)
    expect(mockFetchHistoryPage).toHaveBeenCalledTimes(2)
  })
})

describe('getAssetDetectionNames', () => {
  it('unions file_path with legacy keys so deprecation-window widget values keep matching', () => {
    const names = getAssetDetectionNames(
      {
        id: 'a1',
        name: 'legacy.png',
        asset_hash: 'blake3:abc',
        file_path: 'input/sub/photo.png',
        mime_type: null,
        tags: ['input'],
        user_metadata: { subfolder: 'old-subfolder' }
      },
      { allowCompactSuffix: true }
    )

    // A widget value in any of these legacy shapes (or the new file_path
    // shape) must match — BE-808 RFC §4 says file_path is a locator, not the
    // identity, and workflow widget values do not auto-upgrade.
    expect(names).toEqual(
      expect.arrayContaining([
        'input/sub/photo.png',
        'blake3:abc',
        'legacy.png',
        'old-subfolder/legacy.png'
      ])
    )
  })

  it('falls back to the legacy union when file_path is null', () => {
    const names = getAssetDetectionNames(
      {
        id: 'a1',
        name: 'legacy.png',
        asset_hash: 'blake3:abc',
        file_path: null,
        mime_type: null,
        tags: ['input']
      },
      { allowCompactSuffix: true }
    )

    expect(names).toEqual(expect.arrayContaining(['legacy.png', 'blake3:abc']))
  })

  it('returns an empty list when file_path, asset_hash, and name are all absent', () => {
    const names = getAssetDetectionNames(
      {
        id: 'a1',
        name: '',
        asset_hash: null,
        file_path: null,
        mime_type: null,
        tags: []
      },
      { allowCompactSuffix: true }
    )

    expect(names).toEqual([])
  })

  it('includes slash and backslash subfolder identifiers when file_path is null', () => {
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
