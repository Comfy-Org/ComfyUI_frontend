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
