import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { getDroppedAsset } from '@/utils/eventUtils'

import { startAssetDrag } from './assetDragUtil'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))

function drag(asset: AssetItem) {
  const dataTransfer = new DataTransfer()
  const event = new DragEvent('dragstart', { cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  startAssetDrag(event, asset)
  return getDroppedAsset(dataTransfer)
}

describe('asset drag media sources', () => {
  it.for([
    {
      label: 'server poster',
      assetsEnabled: true,
      preview_id: 'poster-id',
      thumbnail_url: undefined,
      preview_url: undefined,
      poster: 'http://localhost:8188/api/assets/poster-id/content',
      media:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline'
    },
    {
      label: 'distinct thumbnail',
      assetsEnabled: true,
      preview_id: undefined,
      thumbnail_url: '/view?filename=poster.png',
      preview_url: '/view?filename=clip.mp4',
      poster: 'http://localhost:8188/api/view?filename=poster.png',
      media:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline'
    },
    {
      label: 'history video without a poster',
      assetsEnabled: false,
      preview_id: undefined,
      thumbnail_url: '/view?filename=clip.mp4',
      preview_url: '/view?filename=clip.mp4',
      poster: undefined,
      media: 'http://localhost:3000/view?filename=clip.mp4'
    },
    {
      label: 'assets API video without a poster',
      assetsEnabled: true,
      preview_id: undefined,
      thumbnail_url: undefined,
      preview_url: undefined,
      poster: undefined,
      media:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline'
    }
  ])(
    'preserves distinct file/image sources for $label',
    ({
      assetsEnabled,
      preview_id,
      thumbnail_url,
      preview_url,
      poster,
      media
    }) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled
      vi.mocked(api.apiURL).mockImplementation(
        (path) => `http://localhost:8188/api${path}`
      )
      const asset = {
        id: 'video-id',
        name: 'clip.mp4',
        display_name: 'My clip',
        tags: ['input'],
        created_at: '2026-10-05T00:00:00Z',
        updated_at: '2026-10-05T00:00:00Z',
        preview_id,
        thumbnail_url,
        preview_url
      } satisfies AssetItem
      expect(drag(asset)).toMatchObject({
        name: 'My clip',
        kind: 'video',
        mediaUrl: media,
        previewUrl: poster
      })
    }
  )
})
