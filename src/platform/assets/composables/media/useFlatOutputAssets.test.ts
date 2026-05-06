import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as AssetServiceModule from '@/platform/assets/services/assetService'
import { assetService } from '@/platform/assets/services/assetService'

import { _resetForTests, useFlatOutputAssets } from './useFlatOutputAssets'

vi.mock('@/platform/assets/services/assetService', async () => {
  const actual = await vi.importActual<typeof AssetServiceModule>(
    '@/platform/assets/services/assetService'
  )
  return {
    ...actual,
    assetService: { getAssetsByTag: vi.fn() }
  }
})

const PAGE_SIZE = 200

function makeAsset(id: string, name: string, asset_hash?: string): AssetItem {
  return {
    id,
    name,
    asset_hash,
    size: 0,
    tags: ['output']
  }
}

describe('useFlatOutputAssets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(assetService.getAssetsByTag).mockReset()
    _resetForTests()
  })

  it('fetches outputs via getAssetsByTag with the output tag', async () => {
    vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([
      makeAsset('a1', 'image1.png', 'hash1.png'),
      makeAsset('a2', 'image2.png', 'hash2.png')
    ])

    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()

    expect(assetService.getAssetsByTag).toHaveBeenCalledWith(
      'output',
      true,
      expect.objectContaining({ limit: PAGE_SIZE, offset: 0 })
    )
    expect(provider.media.value.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('does not call resolveOutputAssetItems-style per-job detail fetch', async () => {
    vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([])
    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()

    expect(vi.mocked(assetService.getAssetsByTag)).toHaveBeenCalledTimes(1)
  })

  it('marks hasMore=false when the page is short', async () => {
    vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([
      makeAsset('a1', 'one.png')
    ])
    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()
    expect(provider.hasMore.value).toBe(false)
  })

  it('marks hasMore=true when a full page is returned', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeAsset(`a${i}`, `f${i}.png`)
    )
    vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce(fullPage)
    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()
    expect(provider.hasMore.value).toBe(true)
  })

  it('appends and dedupes on loadMore', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeAsset(`a${i}`, `f${i}.png`)
    )
    const secondPage = [
      makeAsset('a0', 'duplicate.png'),
      makeAsset('newId', 'new.png')
    ]
    vi.mocked(assetService.getAssetsByTag)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)

    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()
    await provider.loadMore()

    expect(provider.media.value).toHaveLength(PAGE_SIZE + 1)
    expect(provider.media.value.at(-1)?.id).toBe('newId')
  })

  it('records error and clears media on initial-fetch failure', async () => {
    const err = new Error('network down')
    vi.mocked(assetService.getAssetsByTag).mockRejectedValueOnce(err)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const provider = useFlatOutputAssets()
    const result = await provider.fetchMediaList()

    expect(result).toEqual([])
    expect(provider.error.value).toBe(err)
    expect(provider.loading.value).toBe(false)
    consoleSpy.mockRestore()
  })

  it('refresh resets pagination', async () => {
    vi.mocked(assetService.getAssetsByTag)
      .mockResolvedValueOnce(
        Array.from({ length: PAGE_SIZE }, (_, i) =>
          makeAsset(`a${i}`, `f${i}.png`)
        )
      )
      .mockResolvedValueOnce([makeAsset('fresh', 'fresh.png')])

    const provider = useFlatOutputAssets()
    await provider.fetchMediaList()
    await provider.refresh()

    expect(provider.media.value.map((a) => a.id)).toEqual(['fresh'])
    expect(provider.hasMore.value).toBe(false)
  })

  it('shares state across consumers and dedupes concurrent fetches', async () => {
    let resolvePage!: (assets: AssetItem[]) => void
    const pagePromise = new Promise<AssetItem[]>((res) => {
      resolvePage = res
    })
    vi.mocked(assetService.getAssetsByTag).mockReturnValueOnce(pagePromise)

    const a = useFlatOutputAssets()
    const b = useFlatOutputAssets()

    const p1 = a.fetchMediaList()
    const p2 = b.fetchMediaList()

    expect(vi.mocked(assetService.getAssetsByTag)).toHaveBeenCalledTimes(1)

    resolvePage([makeAsset('shared-1', 'shared.png', 'h.png')])
    await Promise.all([p1, p2])

    expect(a.media.value).toBe(b.media.value)
    expect(a.media.value.map((x) => x.id)).toEqual(['shared-1'])
  })
})
