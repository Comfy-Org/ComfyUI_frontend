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

const asset: ReplyAsset = {
  url: '/api/view?filename=ComfyUI_00001_.png&type=output',
  filename: 'ComfyUI_00001_.png',
  kind: 'image',
  label: 'Generated asset'
}

describe('resolveReplyAssetDownload', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((route) => `/api${route}`)
  })

  it.for([
    { name: 'preview support is disabled', previewSupported: false },
    { name: 'the asset lookup misses', previewSupported: true }
  ])(
    'preserves the source extension when $name',
    async ({ previewSupported }) => {
      vi.mocked(isAssetPreviewSupported).mockReturnValue(previewSupported)
      vi.mocked(findOutputAsset).mockResolvedValue(undefined)

      const download = await resolveReplyAssetDownload(asset)

      expect(download.filename).toBe('Generated asset.png')
    }
  )

  // A loopback reply asset reaches ReplyAsset.url already re-homed onto the
  // page's own API — absolute, and under the install's subpath. The download
  // action has to strip that back to a route, or `api.fetchApi` prefixes the
  // base a second time and the download 404s for exactly the local-agent
  // assets the re-homing exists for.
  it('strips a re-homed absolute url back to an api route', async () => {
    vi.mocked(api.apiURL).mockImplementation(
      (route) => `/ComfyBackendDirect/api${route}`
    )
    vi.mocked(isAssetPreviewSupported).mockReturnValue(false)

    const download = await resolveReplyAssetDownload({
      ...asset,
      url: 'http://100.74.161.87:8190/ComfyBackendDirect/api/view?filename=ComfyUI_00001_.png&type=output'
    })

    expect(download.url).toBe('/view?filename=ComfyUI_00001_.png&type=output')
  })
})
