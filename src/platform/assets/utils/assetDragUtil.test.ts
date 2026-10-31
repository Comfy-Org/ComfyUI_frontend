import { afterEach, assert, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import { api } from '@/scripts/api'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
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
      label: 'absolute CDN thumbnail',
      assetsEnabled: true,
      preview_id: undefined,
      thumbnail_url: 'https://cdn.example/thumb.webp?signature=poster',
      preview_url: '/view?filename=clip.mp4',
      poster: 'https://cdn.example/thumb.webp?signature=poster',
      media:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline'
    },
    {
      label: 'protocol-relative CDN thumbnail',
      assetsEnabled: true,
      preview_id: undefined,
      thumbnail_url: '//cdn.example/thumb.webp',
      preview_url: '/view?filename=clip.mp4',
      poster: 'http://cdn.example/thumb.webp',
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

describe('asset drag identity', () => {
  it.for([
    ['a subfolder', { subfolder: 'previews' }, 'previews/flat_temp.png [temp]'],
    ['no subfolder', undefined, 'flat_temp.png [temp]'],
    ['a non-string subfolder', { subfolder: 7 }, 'flat_temp.png [temp]']
  ] as const)(
    'drops a temp asset with no job and metadata naming %s at its own root and folder',
    ([, user_metadata, written]) => {
      const dataTransfer = new DataTransfer()
      const event = new DragEvent('dragstart', { cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })

      startAssetDrag(event, {
        id: 'flat-temp-asset',
        name: 'flat_temp.png',
        tags: ['output', 'temp'],
        created_at: '2026-10-21T00:00:00Z',
        updated_at: '2026-10-21T00:00:00Z',
        user_metadata
      } satisfies AssetItem)
      const dropped = parseAssetInfo(dataTransfer)

      assert.exists(dropped)
      expect(createAnnotatedPath(dropped)).toBe(written)
    }
  )
})

describe('asset drag root for non-output assets tagged temp', () => {
  it.for([
    ['an input asset', ['input', 'temp'], undefined, 'flat_temp.png'],
    [
      'an input asset whose preview URL says input',
      ['input', 'temp'],
      '/api/view?filename=flat_temp.png&type=input',
      'flat_temp.png'
    ],
    ['a model asset', ['models', 'temp'], undefined, 'flat_temp.png'],
    [
      'an output whose preview URL says input',
      ['output', 'temp'],
      '/api/view?filename=flat_temp.png&type=input',
      'flat_temp.png [output]'
    ],
    [
      'a generated output',
      ['output', 'temp'],
      undefined,
      'flat_temp.png [temp]'
    ]
  ] as const)(
    'drops %s tagged temp at its prior root',
    ([, tags, preview_url, written]) => {
      const dataTransfer = new DataTransfer()
      const event = new DragEvent('dragstart', { cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })

      startAssetDrag(event, {
        id: 'flat-temp-asset',
        name: 'flat_temp.png',
        tags: [...tags],
        preview_url,
        created_at: '2026-10-21T00:00:00Z',
        updated_at: '2026-10-21T00:00:00Z'
      } satisfies AssetItem)
      const dropped = parseAssetInfo(dataTransfer)

      assert.exists(dropped)
      expect(createAnnotatedPath(dropped)).toBe(written)
    }
  )
})

describe('asset drag on browsers without URL.parse or URL.canParse', () => {
  const nativeParse = Object.getOwnPropertyDescriptor(URL, 'parse')
  const nativeCanParse = Object.getOwnPropertyDescriptor(URL, 'canParse')

  afterEach(() => {
    if (nativeParse) Object.defineProperty(URL, 'parse', nativeParse)
    else Reflect.deleteProperty(URL, 'parse')
    if (nativeCanParse) Object.defineProperty(URL, 'canParse', nativeCanParse)
    else Reflect.deleteProperty(URL, 'canParse')
  })

  it('still resolves the drag media sources', () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    vi.mocked(api.apiURL).mockImplementation(
      (path) => `http://localhost:8188/api${path}`
    )
    for (const name of ['parse', 'canParse'])
      Object.defineProperty(URL, name, {
        configurable: true,
        value: undefined
      })

    expect(
      drag({
        id: 'video-id',
        name: 'clip.mp4',
        display_name: 'My clip',
        tags: ['input'],
        created_at: '2026-10-05T00:00:00Z',
        updated_at: '2026-10-05T00:00:00Z',
        thumbnail_url: '/view?filename=poster.png',
        preview_url: '/view?filename=clip.mp4'
      })
    ).toMatchObject({
      kind: 'video',
      mediaUrl:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline',
      previewUrl: 'http://localhost:8188/api/view?filename=poster.png'
    })
  })
})
