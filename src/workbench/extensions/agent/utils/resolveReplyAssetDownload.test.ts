import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  findOutputAsset,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'
import { resolveReplyAssetDownload } from './resolveReplyAssetDownload'

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'))
vi.mock(import('@/scripts/api'))

const generatedAsset: ReplyAsset = {
  url: '/api/view?filename=ComfyUI_00001_.png&type=output',
  filename: 'ComfyUI_00001_.png',
  kind: 'image',
  label: 'Generated asset'
}

function asset(url: string): ReplyAsset {
  return { url, filename: 'a.png', kind: 'image' }
}

describe('resolveReplyAssetDownload', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation(
      (route) => `${window.location.origin}/api${route}`
    )
    vi.mocked(api.fetchApi).mockResolvedValue(new Response())
    vi.mocked(fetch).mockResolvedValue(new Response())
  })

  it.for([
    { name: 'preview support is disabled', previewSupported: false },
    { name: 'the asset lookup misses', previewSupported: true }
  ])(
    'preserves the source extension when $name',
    async ({ previewSupported }) => {
      vi.mocked(isAssetPreviewSupported).mockReturnValue(previewSupported)
      vi.mocked(findOutputAsset).mockResolvedValue(undefined)

      const download = await resolveReplyAssetDownload(generatedAsset)

      expect(download.filename).toBe('Generated asset.png')
    }
  )

  it('uses the asset basename and preserves the source extension', async () => {
    vi.mocked(isAssetPreviewSupported).mockReturnValue(true)
    vi.mocked(findOutputAsset).mockResolvedValue({
      id: 'a1',
      name: 'output/Final render'
    })

    const download = await resolveReplyAssetDownload(generatedAsset)

    expect(download.filename).toBe('Final render.png')
  })

  it('authenticates a media route on this API through fetchApi', async () => {
    const resolved = await resolveReplyAssetDownload(
      asset(`${window.location.origin}/api/assets/asset-1/content`)
    )

    expect(resolved.url).toBe('/assets/asset-1/content')
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).toHaveBeenCalledWith('/assets/asset-1/content')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('omits credentials for any other URL', async () => {
    const url = `${window.location.origin}/api/system_stats?filename=a.png`
    const resolved = await resolveReplyAssetDownload(asset(url))

    expect(resolved.url).toBe(url)
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(url, { credentials: 'omit' })
  })
})
