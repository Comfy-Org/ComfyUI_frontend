import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/platform/assets/stores/assetsStore'

import { resolveWidgetValueAsset } from '@/platform/assets/integration/resolveWidgetValueAsset'

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))

const templateHash =
  '2222222222222222222222222222222222222222222222222222222222222222.png'

beforeEach(() => {
  vi.mocked(useFeatureFlags().flags).assetsEnabled = true
  vi.mocked(api.fetchApi).mockImplementation(async () =>
    Response.json({ assets: [], total: 0, has_more: false })
  )
  const store = useAssetsStore()
  store.inputAssets = fromPartial({ items: [] })
  store.outputAssets = fromPartial({ items: [] })
})

describe('resolveWidgetValueAsset', () => {
  it.for([
    { value: 'sky.exr [input]', expected: null },
    { value: 'blake3:sky [input]', expected: 'output-sky' }
  ])(
    'resolves $value across roots only by hash for a hashed asset',
    async ({ value, expected }) => {
      useAssetsStore().outputAssets = fromPartial({
        items: [
          {
            id: 'output-sky',
            name: 'sky.exr',
            loader_path: 'sky.exr',
            hash: 'blake3:sky'
          }
        ]
      })

      const asset = await resolveWidgetValueAsset(value)

      expect(asset && asset.id).toBe(expected)
    }
  )

  it('resolves a filesystem loader path even when the asset has a hash', async () => {
    const store = useAssetsStore()
    store.inputAssets = fromPartial({
      items: [
        {
          id: 'nested',
          name: 'sky.exr',
          loader_path: 'references/drafts/sky.exr',
          hash: 'blake3:sky',
          preview_id: 'nested-preview'
        },
        { id: 'root', name: 'sky.exr', preview_id: 'root-preview' }
      ]
    })

    const asset = await resolveWidgetValueAsset('references/drafts/sky.exr')

    expect(asset?.preview_id).toBe('nested-preview')
  })

  it('resolves a nested output after reload without selecting the same basename from another folder', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      Response.json({
        assets: [
          {
            id: 'other',
            name: 'sky.exr',
            loader_path: 'other/sky.exr',
            tags: ['output'],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
          },
          {
            id: 'nested',
            name: 'sky.exr',
            loader_path: 'renders/drafts/sky.exr',
            tags: ['output'],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
          }
        ],
        total: 2,
        has_more: false
      })
    )

    const asset = await resolveWidgetValueAsset(
      'renders/drafts/sky.exr [output]'
    )

    expect(asset?.id).toBe('nested')
  })

  it.for([
    { hasMore: false, expected: null },
    { hasMore: true, expected: undefined }
  ])(
    'distinguishes a complete lookup from an inconclusive one when has_more is $hasMore',
    async ({ hasMore, expected }) => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        Response.json({
          assets: [],
          total: 0,
          has_more: hasMore,
          next_cursor: 'next-page'
        })
      )

      await expect(
        resolveWidgetValueAsset('gone/photo.png [output]')
      ).resolves.toBe(expected)
      expect(
        vi
          .mocked(api.fetchApi)
          .mock.calls.filter(([url]) => url.includes('name_contains=photo.png'))
      ).toHaveLength(1)
    }
  )

  it('uses the Cloud hash lookup for a folder-qualified filename', async () => {
    mockDistributionState.isCloud = true
    onTestFinished(() => {
      mockDistributionState.isCloud = false
    })
    vi.mocked(api.fetchApi).mockImplementation(async (url) => {
      const params = new URL(url, 'http://localhost').searchParams
      const assets =
        params.get('hash') === 'flat_folder.png'
          ? [
              {
                id: 'survivor',
                name: 'flat_folder.png',
                hash: 'blake3:survivor',
                tags: ['output'],
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
              }
            ]
          : []
      return Response.json({ assets, total: assets.length, has_more: false })
    })

    const asset = await resolveWidgetValueAsset(
      'previews/flat_folder.png [output]'
    )

    expect(asset?.id).toBe('survivor')
  })

  it('asks for public assets explicitly in the remote hash lookup', async () => {
    await resolveWidgetValueAsset(templateHash)

    const hashLookups = vi
      .mocked(api.fetchApi)
      .mock.calls.map(([url]) => new URLSearchParams(url.split('?')[1]))
      .filter((params) => params.has('hash'))
    expect(hashLookups).toHaveLength(1)
    expect(hashLookups[0].get('hash')).toBe(templateHash)
    expect(hashLookups[0].get('include_public')).toBe('true')
  })

  it.for([
    { runtime: 'cloud', isCloud: true, expected: 'true' },
    { runtime: 'local', isCloud: false, expected: null }
  ])(
    'sends capped_total=$expected in the hash lookup on $runtime',
    async ({ isCloud, expected }) => {
      mockDistributionState.isCloud = isCloud
      onTestFinished(() => {
        mockDistributionState.isCloud = false
      })

      await resolveWidgetValueAsset(templateHash)

      const hashLookups = vi
        .mocked(api.fetchApi)
        .mock.calls.map(
          ([url]) => new URL(url, 'http://localhost').searchParams
        )
        .filter((params) => params.has('hash'))
      expect(hashLookups).toHaveLength(1)
      expect(hashLookups[0].get('capped_total')).toBe(expected)
    }
  )

  it.for([
    { value: 'sky.exr', previewId: 'input-preview' },
    { value: 'sky.exr [output]', previewId: 'output-preview' },
    { value: 'sky.exr [temp]', previewId: 'output-preview' }
  ])(
    'resolves $value from its own root when input and output share a name',
    async ({ value, previewId }) => {
      const store = useAssetsStore()
      store.inputAssets = fromPartial({
        items: [{ name: 'sky.exr', preview_id: 'input-preview' }]
      })
      store.outputAssets = fromPartial({
        items: [{ name: 'sky.exr', preview_id: 'output-preview' }]
      })

      const asset = await resolveWidgetValueAsset(value)

      expect(asset?.preview_id).toBe(previewId)
    }
  )

  it.for([
    { value: 'sky.exr [output]', previewId: 'root-preview' },
    { value: 'renders/sky.exr [output]', previewId: 'renders-preview' },
    { value: 'renders\\sky.exr [output]', previewId: 'renders-preview' }
  ])(
    'resolves unhashed $value by its subfolder',
    async ({ value, previewId }) => {
      const store = useAssetsStore()
      store.outputAssets = fromPartial({
        items: [
          {
            name: 'sky.exr',
            user_metadata: { subfolder: 'renders' },
            preview_id: 'renders-preview'
          },
          { name: 'sky.exr', preview_id: 'root-preview' }
        ]
      })

      const asset = await resolveWidgetValueAsset(value)

      expect(asset?.preview_id).toBe(previewId)
    }
  )
})
