import { describe, expect, it } from 'vitest'

import type { LightboxItem } from '@/types/lightboxItem'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  fileLightboxItem,
  findLightboxIndexByUrl,
  resultItemsToLightboxItems
} from '@/utils/lightboxItem'

describe('findLightboxIndexByUrl', () => {
  const items: LightboxItem[] = [
    { kind: 'image', url: 'a' },
    { kind: 'image', url: 'b' },
    { kind: 'image', url: 'c' }
  ]

  it.for([
    ['b', 1],
    ['missing', 0],
    [undefined, 0]
  ] as const satisfies readonly (readonly [string | undefined, number])[])(
    'resolves %s to index %i',
    ([url, expected]) => {
      expect(findLightboxIndexByUrl(items, url)).toBe(expected)
    }
  )
})

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

describe('resultItemsToLightboxItems', () => {
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

  it('drops unrenderable records so navigation never lands on a blank frame', () => {
    const items = resultItemsToLightboxItems([
      record({ filename: 'a.png', mediaType: 'images' }),
      record({ filename: 'mesh.glb' }),
      record({ filename: 'b.png', mediaType: 'images' })
    ])

    expect(items).toEqual([
      { kind: 'image', url: '/api/view?filename=a.png', alt: 'a.png' },
      { kind: 'image', url: '/api/view?filename=b.png', alt: 'b.png' }
    ])
  })

  it('keeps the advanced preview url for videos', () => {
    const [item] = resultItemsToLightboxItems([
      record({ filename: 'clip.mp4', mediaType: 'video' })
    ])

    expect(item).toMatchObject({ kind: 'video', mimeType: 'video/mp4' })
    expect(item).toHaveProperty(
      'advancedPreviewUrl',
      expect.stringContaining('/viewvideo?filename=clip.mp4')
    )
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
      'clip.mp4',
      { mediaType: 'video' },
      {
        kind: 'video',
        url: '/api/view?filename=clip.mp4',
        mimeType: 'video/mp4'
      }
    ]
  ] as const satisfies readonly (readonly [
    string,
    Partial<AugmentedResultItem>,
    LightboxItem
  ])[])('adapts %s to its rendering kind', ([filename, over, expected]) => {
    expect(
      resultItemsToLightboxItems([record({ filename, ...over })])
    ).toMatchObject([expected])
  })
})
