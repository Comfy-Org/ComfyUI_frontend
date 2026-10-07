import { describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from '@/config/models-catalogue'
import { hubMenuPreviews, hubMenuPreviewsFor } from './menu-previews'

const router = (
  fields: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel => ({
  slug: 'x',
  name: 'X',
  workflowCount: 0,
  capabilities: [],
  routerId: 'vendor/x',
  href: '/hub/models/x/',
  ...fields
})

describe('hubMenuPreviewsFor', () => {
  it.for([
    {
      name: 'an image thumbnail',
      thumbnail: { url: 'https://m/a.png', kind: 'image' as const },
      still: 'https://m/a.png'
    },
    {
      name: "a video's poster",
      thumbnail: {
        url: 'https://m/a.mp4',
        kind: 'video' as const,
        poster: 'https://m/a.jpg'
      },
      still: 'https://m/a.jpg'
    },
    {
      name: 'nothing for a video without a poster',
      thumbnail: { url: 'https://m/a.mp4', kind: 'video' as const },
      still: undefined
    },
    {
      name: 'nothing for audio',
      thumbnail: { url: 'https://m/a.wav', kind: 'audio' as const },
      still: undefined
    }
  ])('shows $name as the still', ({ thumbnail, still }) => {
    const previews = hubMenuPreviewsFor(
      [router({ thumbnail })],
      ['/hub/models/x/'],
      'en'
    )
    expect(previews['/hub/models/x/'].thumbnail).toBe(still)
  })

  it.for([
    {
      model: router({ provider: 'ByteDance', modality: 'image' }),
      locale: 'en' as const,
      meta: 'ByteDance · Image'
    },
    {
      model: router({ provider: 'Kling', modality: 'video' }),
      locale: 'zh-CN' as const,
      meta: 'Kling · 视频'
    },
    {
      model: router({ provider: 'Kling' }),
      locale: 'en' as const,
      meta: 'Kling'
    },
    { model: router(), locale: 'en' as const, meta: undefined }
  ])('names a model as $meta in $locale', ({ model, locale, meta }) => {
    expect(
      hubMenuPreviewsFor([model], ['/hub/models/x/'], locale)['/hub/models/x/']
        .meta
    ).toBe(meta)
  })

  it('leaves out pages the menu does not list', () => {
    expect(hubMenuPreviewsFor([router()], ['/hub/models/y/'], 'en')).toEqual({})
  })
})

describe('hubMenuPreviews', () => {
  it('previews every Hub example from the catalogue', () => {
    expect(hubMenuPreviews('en')).toEqual({
      '/hub/models/seedream-5-0-pro-text-to-image/': {
        thumbnail: expect.stringMatching(/^https:\/\/.+\.png$/),
        meta: 'ByteDance · Image'
      },
      '/hub/models/kling-o3-text-to-video/': {
        thumbnail: undefined,
        meta: 'Kling · Video'
      },
      '/hub/workflows/change-material/': {
        thumbnail: expect.stringMatching(/^https:\/\/.+\.webp$/),
        meta: 'Edit images'
      },
      '/hub/workflows/match-lighting/': {
        thumbnail: expect.stringMatching(/^https:\/\/.+\.webp$/),
        meta: 'Edit images'
      },
      '/hub/apps/cinematic-studio/': {
        thumbnail: expect.stringMatching(/poster\.jpg$/),
        meta: expect.stringMatching(/\S/)
      },
      '/hub/apps/reshoot/': {
        thumbnail: expect.stringMatching(/poster\.jpg$/),
        meta: expect.stringMatching(/\S/)
      }
    })
  })
})
