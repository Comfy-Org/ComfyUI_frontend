import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'

import { vfxLandingV3 } from './vfxLandingV3'

describe('vfxLandingV3', () => {
  it.for([
    { locale: 'en', contactHref: '/contact/?interest=vfx&landing_version=v3' },
    {
      locale: 'zh-CN',
      contactHref: '/zh-CN/contact/?interest=vfx&landing_version=v3'
    }
  ] as const)(
    'preserves VFX V3 sales attribution for $locale',
    ({ locale, contactHref }) => {
      expect(vfxLandingV3(locale, translationsFor(locale).t).contactHref).toBe(
        contactHref
      )
    }
  )

  it('uses the V3 workstation title and preserves the other pipeline benefits', () => {
    const { benefits } = vfxLandingV3('en', translationsFor('en').t)

    expect(benefits.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'pipeline-1', title: 'Workstations & rendering' },
      { id: 'pipeline-2', title: 'Control in the graph' },
      { id: 'pipeline-3', title: 'API & SDK' },
      { id: 'pipeline-4', title: 'Custom nodes & DCCs' }
    ])
    expect(benefits[0].description).toBe(
      'Run ComfyUI on hardware you control. Scope shared infrastructure and deployment with your technical team.'
    )
  })

  it('features the Seedance video followed by the two curated workflow stills', () => {
    const { featuredWorkflows } = vfxLandingV3('en', translationsFor('en').t)

    expect(featuredWorkflows).toMatchObject([
      {
        title: 'Storyboard to Seedance',
        href: 'https://comfy.org/workflows/f4e29143100c-f4e29143100c/',
        media:
          'https://media.comfy.org/hub-media/video/34ea9f1a-1aac-4c6f-af48-b88cf154ec9b.mp4',
        mediaType: 'video',
        tags: ['Seedance 2.0', 'Storyboarding']
      },
      {
        title: 'Minimax H3 Video Restyling',
        mediaType: 'image',
        media:
          'https://media.comfy.org/hub-media/posters/93d4af64-c1a4-4a44-8d5a-e1f4d0ea28e3.jpg'
      },
      {
        title: 'LTX Cleanplate VFX',
        mediaType: 'image',
        media:
          'https://media.comfy.org/hub-media/posters/8a3a846f-5017-428e-b2a2-24025c55e884.jpg'
      }
    ])
  })

  it('localizes the V3 benefit override and featured workflow title', () => {
    const { benefits, featuredWorkflows } = vfxLandingV3(
      'zh-CN',
      translationsFor('zh-CN').t
    )

    expect(benefits[0].title).toBe('工作站与渲染')
    expect(benefits[1].title).toBe('在节点图中掌控流程')
    expect(featuredWorkflows[0].title).toBe('从故事板到 Seedance')
  })
})
