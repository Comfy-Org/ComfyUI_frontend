import { describe, expect, it } from 'vitest'

import type { LightboxItem } from '@/types/lightboxItem'
import { fileLightboxItem } from '@/utils/lightboxItem'

describe('fileLightboxItem', () => {
  it.for([
    ['picture.png', { kind: 'image', url: 'u', alt: 'picture.png' }],
    ['clip.mp4', { kind: 'video', url: 'u', mimeType: 'video/mp4' }],
    ['clip.webm', { kind: 'video', url: 'u', mimeType: 'video/webm' }],
    ['clip.mkv', { kind: 'video', url: 'u', mimeType: undefined }],
    ['track.mp3', { kind: 'audio', url: 'u' }],
    ['notes.txt', { kind: 'text', url: 'u' }],
    ['model.glb', { kind: 'unsupported', url: 'u' }]
  ] as const satisfies readonly (readonly [string, LightboxItem])[])(
    'classifies %s from its extension',
    ([filename, expected]) => {
      expect(fileLightboxItem('u', filename)).toEqual(expected)
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
