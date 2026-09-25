import { describe, expect, it } from 'vitest'

import { workshopPages } from '../../config/workshop-page-content'
import { modelOgImage } from './model-page'

const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/i

describe('modelOgImage', () => {
  it.for([
    {
      kind: 'image',
      url: 'https://cdn.test/a.webp',
      expected: 'https://cdn.test/a.webp'
    },
    { kind: 'video', url: 'https://cdn.test/a.mp4', expected: undefined },
    { kind: 'audio', url: 'https://cdn.test/a.mp3', expected: undefined }
  ] as const)(
    'uses a $kind thumbnail only when it is an image',
    ({ kind, url, expected }) => {
      expect(modelOgImage({ thumbnail: { kind, url } })).toBe(expected)
    }
  )

  it('falls back to the default card when a model has no thumbnail', () => {
    expect(modelOgImage({})).toBeUndefined()
  })

  it('never returns a video for any model page', () => {
    const videoPages = workshopPages
      .filter((model) => VIDEO_EXTENSION.test(modelOgImage(model) ?? ''))
      .map((model) => model.slug)
    expect(videoPages).toEqual([])
  })

  it('keeps the own thumbnail on every image-thumbnail model page', () => {
    const imagePages = workshopPages.filter(
      (model) => model.thumbnail?.kind === 'image'
    )
    expect(imagePages.length).toBeGreaterThan(0)
    for (const model of imagePages)
      expect(modelOgImage(model)).toBe(model.thumbnail?.url)
  })
})
