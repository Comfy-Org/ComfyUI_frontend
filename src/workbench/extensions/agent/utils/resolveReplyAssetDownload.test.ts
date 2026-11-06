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

  it('authenticates an exact same-origin API view route', async () => {
    const resolved = await resolveReplyAssetDownload(
      asset(`${window.location.origin}/api/view?filename=a.png`)
    )

    expect(resolved.url).toBe('/view?filename=a.png')
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'an off-origin URL embedding the API base',
      url: `https://evil.example/x/${window.location.origin}/api/view?filename=a.png`
    },
    {
      name: 'a non-view API route',
      url: `${window.location.origin}/api/system_stats?filename=a.png`
    },
    {
      name: 'a view-route descendant',
      url: `${window.location.origin}/api/view/extra?filename=a.png`
    },
    {
      name: 'a view-route prefix',
      url: `${window.location.origin}/api/viewevil?filename=a.png`
    },
    {
      name: 'a view-route suffix',
      url: `${window.location.origin}/evil/api/view?filename=a.png`
    },
    {
      name: 'a view-route substring',
      url: `${window.location.origin}/x/api/view/y?filename=a.png`
    }
  ])('omits credentials for $name', async ({ url }) => {
    const resolved = await resolveReplyAssetDownload(asset(url))

    expect(resolved.url).toBe(url)
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(url, { credentials: 'omit' })
  })

  it('rejects a malformed URL before resolving a request', async () => {
    await expect(resolveReplyAssetDownload(asset('http://['))).rejects.toThrow()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('strips a re-homed absolute url back to an api route', async () => {
    vi.mocked(api.apiURL).mockImplementation(
      (route) => `/ComfyBackendDirect/api${route}`
    )
    vi.mocked(isAssetPreviewSupported).mockReturnValue(false)

    const download = await resolveReplyAssetDownload({
      ...generatedAsset,
      url: `${window.location.origin}/ComfyBackendDirect/api/view?filename=ComfyUI_00001_.png&type=output`
    })

    expect(download.url).toBe('/view?filename=ComfyUI_00001_.png&type=output')
  })
})
