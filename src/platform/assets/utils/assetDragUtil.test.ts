import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import {
  parseAssetInfo,
  getDroppedAsset
} from '@/platform/assets/integration/assetDrop'
import { api } from '@/scripts/api'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import type { AugmentedResultItem } from '@/utils/resultItem'

import {
  isDraggableResultItem,
  startAssetDrag,
  startResultItemDrag
} from './assetDragUtil'

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
  it('still resolves the drag media sources', () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    vi.mocked(api.apiURL).mockImplementation(
      (path) => `http://localhost:8188/api${path}`
    )
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, {
        parse: undefined,
        canParse: undefined
      })
    )

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
      uri: 'http://localhost:8188/api/assets/video-id/content',
      mediaUrl:
        'http://localhost:8188/api/assets/video-id/content?disposition=inline',
      previewUrl: 'http://localhost:8188/api/view?filename=poster.png'
    })
  })
})

describe('job output drag', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation(
      (path) => `http://localhost:8188/api${path}`
    )
  })

  function buildOutput(
    overrides: Partial<AugmentedResultItem>
  ): AugmentedResultItem {
    return {
      filename: 'frame_00002_.png',
      subfolder: '',
      type: 'output',
      mediaType: 'images',
      nodeId: '9',
      ...overrides
    }
  }

  function dragOutput(output: AugmentedResultItem) {
    const dataTransfer = new DataTransfer()
    const event = new DragEvent('dragstart', { cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
    startResultItemDrag(event, output)
    return dataTransfer
  }

  it.for([
    [
      'a saved output at the output root',
      { filename: 'frame_00002_.png', subfolder: '', type: 'output' },
      'frame_00002_.png [output]'
    ],
    [
      'a preview in a temp subfolder',
      { filename: 'ComfyUI_temp_x.png', subfolder: 'previews', type: 'temp' },
      'previews/ComfyUI_temp_x.png [temp]'
    ]
  ] as const)(
    'drops %s on a loader node as a reference to that same file',
    ([, location, written]) => {
      const dropped = parseAssetInfo(dragOutput(buildOutput(location)))

      assert.exists(dropped)
      expect(createAnnotatedPath(dropped)).toBe(written)
    }
  )

  it.for([
    {
      label: 'an image',
      output: { filename: 'frame_00002_.png', mediaType: 'images' },
      expected: {
        name: 'frame_00002_.png',
        ref: 'frame_00002_.png',
        kind: 'image',
        uri: 'http://localhost:8188/api/view?filename=frame_00002_.png&type=output&subfolder=',
        previewUrl:
          'http://localhost:8188/api/view?filename=frame_00002_.png&type=output&subfolder=',
        mediaUrl: undefined
      }
    },
    {
      label: 'a hash-named video',
      output: {
        filename: 'a1b2c3.mp4',
        hash: 'blake3:abcdef0123456789',
        display_name: 'clip_00001_.mp4',
        mediaType: 'video'
      },
      expected: {
        name: 'clip_00001_.mp4',
        ref: 'blake3:abcdef0123456789',
        kind: 'video',
        uri: 'http://localhost:8188/api/view?filename=a1b2c3.mp4&type=output&subfolder=',
        previewUrl: undefined,
        mediaUrl:
          'http://localhost:8188/api/view?filename=a1b2c3.mp4&type=output&subfolder='
      }
    },
    {
      label: 'a video whose suffix only its media type identifies',
      output: { filename: 'clip.mpeg', mediaType: 'video' },
      expected: {
        name: 'clip.mpeg',
        ref: 'clip.mpeg',
        kind: 'video',
        uri: 'http://localhost:8188/api/view?filename=clip.mpeg&type=output&subfolder=',
        previewUrl: undefined,
        mediaUrl:
          'http://localhost:8188/api/view?filename=clip.mpeg&type=output&subfolder='
      }
    },
    {
      label: 'audio',
      output: { filename: 'voice.wav', mediaType: 'audio' },
      expected: {
        name: 'voice.wav',
        ref: 'voice.wav',
        kind: 'audio',
        uri: 'http://localhost:8188/api/view?filename=voice.wav&type=output&subfolder=',
        previewUrl: undefined,
        mediaUrl:
          'http://localhost:8188/api/view?filename=voice.wav&type=output&subfolder='
      }
    },
    {
      label: 'a 3D model',
      output: { filename: 'mesh.glb', mediaType: 'model' },
      expected: {
        name: 'mesh.glb',
        ref: 'mesh.glb',
        kind: '3D',
        uri: 'http://localhost:8188/api/view?filename=mesh.glb&type=output&subfolder=',
        previewUrl: undefined,
        mediaUrl: undefined
      }
    }
  ])(
    'hands the canvas and agent composer the file of $label',
    ({ output, expected }) => {
      expect(getDroppedAsset(dragOutput(buildOutput(output)))).toMatchObject(
        expected
      )
    }
  )

  it.for([
    ['a text result', { filename: '', mediaType: 'text', content: 'hello' }],
    ['a saved text file', { filename: 'notes.txt', mediaType: 'text' }]
  ] as const)('leaves %s undraggable and carrying nothing', ([, output]) => {
    const item = buildOutput(output)

    expect(isDraggableResultItem(item)).toBe(false)
    expect(dragOutput(item).types).toEqual([])
  })
})
