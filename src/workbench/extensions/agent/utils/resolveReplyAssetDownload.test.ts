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
})
