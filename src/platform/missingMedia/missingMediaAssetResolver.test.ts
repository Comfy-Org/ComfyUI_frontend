import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as AssetServiceModule from '@/platform/assets/services/assetService'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type * as ApiModule from '@/scripts/api'
import {
  getAssetDetectionNames,
  resolveMissingMediaAssetSources
} from './missingMediaAssetResolver'

const { mockGetInputAssetsIncludingPublic } = vi.hoisted(() => ({
  mockGetInputAssetsIncludingPublic: vi.fn()
}))

const { mockGetHistoryPage } = vi.hoisted(() => ({
  mockGetHistoryPage: vi.fn()
}))

vi.mock('@/platform/assets/services/assetService', async () => {
  const actual = await vi.importActual<typeof AssetServiceModule>(
    '@/platform/assets/services/assetService'
  )

  return {
    ...actual,
    assetService: {
      ...actual.assetService,
      getInputAssetsIncludingPublic: mockGetInputAssetsIncludingPublic
    }
  }
})

vi.mock('@/scripts/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('@/scripts/api')

  return {
    ...actual,
    api: new Proxy(actual.api, {
      get(target, prop, receiver) {
        if (prop === 'getHistoryPage') return mockGetHistoryPage
        return Reflect.get(target, prop, receiver)
      }
    })
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

describe('resolveMissingMediaAssetSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInputAssetsIncludingPublic.mockResolvedValue([])
    mockGetHistoryPage.mockResolvedValue(makeHistoryPage([]))
  })

  it('loads cloud input assets when requested', async () => {
    const inputAsset = makeAsset('photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValue([inputAsset])

    const result = await resolveMissingMediaAssetSources({
      includeCloudInputAssets: true,
      includeGeneratedAssets: false,
      generatedMatchNames: new Set(),
      allowCompactSuffix: true
    })

    expect(result.inputAssets).toEqual([inputAsset])
    expect(result.generatedAssets).toEqual([])
    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(undefined)
    expect(mockGetHistoryPage).not.toHaveBeenCalled()
  })

  it('stops reading generated history once all requested names are found', async () => {
    const target = 'target.png'
    mockGetHistoryPage.mockResolvedValueOnce(
      makeHistoryPage([makeHistoryJob(target)], {
        hasMore: true,
        total: 400
      })
    )

    const result = await resolveMissingMediaAssetSources({
      includeCloudInputAssets: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toHaveLength(1)
    expect(result.generatedAssets[0].name).toBe(target)
    expect(mockGetHistoryPage).toHaveBeenCalledOnce()
  })

  it('advances pagination from the requested offset, not the echoed offset', async () => {
    const target = 'target.png'
    mockGetHistoryPage
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
      includeCloudInputAssets: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([target]),
      allowCompactSuffix: true
    })

    expect(mockGetHistoryPage).toHaveBeenNthCalledWith(1, 200, { offset: 0 })
    expect(mockGetHistoryPage).toHaveBeenNthCalledWith(2, 200, { offset: 200 })
  })

  it('stops if history reports hasMore but returns an empty page', async () => {
    mockGetHistoryPage.mockResolvedValueOnce(
      makeHistoryPage([], { hasMore: true, total: 1 })
    )

    const result = await resolveMissingMediaAssetSources({
      includeCloudInputAssets: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['missing.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toEqual([])
    expect(mockGetHistoryPage).toHaveBeenCalledOnce()
  })

  it('stops if history repeats the same job page', async () => {
    const repeatedJob = makeHistoryJob('other.png', { id: 'same-job' })
    mockGetHistoryPage
      .mockResolvedValueOnce(
        makeHistoryPage([repeatedJob], { hasMore: true, total: 2 })
      )
      .mockResolvedValueOnce(
        makeHistoryPage([repeatedJob], { offset: 1, hasMore: true, total: 2 })
      )

    const result = await resolveMissingMediaAssetSources({
      includeCloudInputAssets: false,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set(['missing.png']),
      allowCompactSuffix: true
    })

    expect(result.generatedAssets).toHaveLength(1)
    expect(mockGetHistoryPage).toHaveBeenCalledTimes(2)
  })

  it('includes slash and backslash subfolder identifiers for detection', () => {
    const names = getAssetDetectionNames(
      {
        ...makeAsset('photo.png'),
        user_metadata: { subfolder: 'nested/folder' }
      },
      { allowCompactSuffix: true }
    )

    expect(names).toEqual(
      expect.arrayContaining([
        'photo.png',
        'nested/folder/photo.png',
        'nested\\folder\\photo.png'
      ])
    )
  })
})
