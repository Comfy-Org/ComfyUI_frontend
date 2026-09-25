import { describe, expect, it } from 'vitest'

import type { LightboxItem } from '@/types/lightboxItem'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { fileLightboxItem, resultLightboxEntries } from '@/utils/lightboxItem'

describe('fileLightboxItem', () => {
  it.for([
    ['picture.png', { kind: 'image', url: 'u', alt: 'picture.png' }],
    ['clip.mp4', { kind: 'video', url: 'u', mimeType: 'video/mp4' }],
    ['clip.webm', { kind: 'video', url: 'u', mimeType: 'video/webm' }],
    ['clip.mkv', { kind: 'video', url: 'u', mimeType: undefined }],
    ['track.mp3', { kind: 'audio', url: 'u' }],
    ['notes.txt', { kind: 'text', url: 'u' }]
  ] as const satisfies readonly (readonly [string, LightboxItem])[])(
    'classifies %s from its extension',
    ([filename, expected]) => {
      expect(fileLightboxItem('u', filename)).toEqual(expected)
    }
  )

  it.for(['model.glb', 'archive.zip'])(
    'has no item for unrenderable %s',
    (filename) => {
      expect(fileLightboxItem('u', filename)).toBeUndefined()
    }
  )

  it('carries the advanced preview url so VHS playback survives', () => {
    expect(
      fileLightboxItem('/api/view?filename=a.mkv', 'a.mkv', '/api/viewvideo?x')
    ).toEqual({
      kind: 'video',
      url: '/api/view?filename=a.mkv',
      mimeType: undefined,
      advancedPreviewUrl: '/api/viewvideo?x'
    })
  })

  it('leaves non-video kinds untouched by an advanced preview url', () => {
    expect(fileLightboxItem('/u.png', 'u.png', '/api/viewvideo?x')).toEqual({
      kind: 'image',
      url: '/u.png',
      alt: 'u.png'
    })
  })
})

describe('resultLightboxEntries', () => {
  const record = (
    over: Partial<AugmentedResultItem> & { filename: string }
  ): AugmentedResultItem => ({
    subfolder: 'out',
    type: 'output',
    nodeId: '1',
    mediaType: '',
    url: `/api/view?filename=${over.filename}`,
    ...over
  })

  it('drops unrenderable records and keeps each item paired with its source', () => {
    const renderable = [
      record({ filename: 'a.png', mediaType: 'images' }),
      record({ filename: 'b.png', mediaType: 'images' })
    ]

    const entries = resultLightboxEntries([
      renderable[0],
      record({ filename: 'mesh.glb' }),
      renderable[1]
    ])

    expect(entries).toEqual([
      {
        source: renderable[0],
        item: { kind: 'image', url: '/api/view?filename=a.png', alt: 'a.png' }
      },
      {
        source: renderable[1],
        item: { kind: 'image', url: '/api/view?filename=b.png', alt: 'b.png' }
      }
    ])
  })

  it.for([
    [
      'track.flac',
      { mediaType: 'audio' },
      { kind: 'audio', url: '/api/view?filename=track.flac' }
    ],
    [
      'notes.txt',
      { mediaType: 'text', content: 'inline' },
      { kind: 'text', url: '/api/view?filename=notes.txt', content: 'inline' }
    ],
    [
      'a.png',
      { mediaType: 'images' },
      { kind: 'image', url: '/api/view?filename=a.png', alt: 'a.png' }
    ]
  ] as const satisfies readonly (readonly [
    string,
    Partial<AugmentedResultItem>,
    LightboxItem
  ])[])('adapts %s to its rendering kind', ([filename, over, expected]) => {
    const entries = resultLightboxEntries([record({ filename, ...over })])

    expect(entries.map(({ item }) => item)).toEqual([expected])
  })

  it('adapts a video with both its source type and advanced preview url', () => {
    const entries = resultLightboxEntries([
      record({ filename: 'clip.mp4', mediaType: 'video' })
    ])

    expect(entries.map(({ item }) => item)).toEqual([
      {
        kind: 'video',
        url: '/api/view?filename=clip.mp4',
        mimeType: 'video/mp4',
        advancedPreviewUrl: expect.stringContaining(
          '/viewvideo?filename=clip.mp4'
        )
      }
    ])
  })
})
