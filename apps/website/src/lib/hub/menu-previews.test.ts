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
        meta: 'ByteDance · Image'
      },
      '/hub/models/seedance-2-5-reference-to-video/': {
        meta: 'ByteDance · Video'
      },
      '/hub/models/nano-banana-2-image-edit/': {
        meta: 'Google · Image'
      },
      '/hub/models/gpt-image-2-text-to-image/': {
        meta: 'OpenAI · Image'
      },
      '/hub/workflows/change-material/': {
        meta: 'Edit images'
      },
      '/hub/workflows/match-lighting/': {
        meta: 'Edit images'
      },
      '/hub/apps/cinematic-studio/': {
        meta: expect.stringMatching(/\S/)
      },
      '/hub/apps/reshoot/': {
        meta: expect.stringMatching(/\S/)
      }
    })
  })
})
