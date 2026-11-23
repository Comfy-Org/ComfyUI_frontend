import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'

import { resolveWidgetValueAsset } from './resolveWidgetValueAsset'

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
    vi.mocked(api.fetchApi).mockResolvedValue(
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
