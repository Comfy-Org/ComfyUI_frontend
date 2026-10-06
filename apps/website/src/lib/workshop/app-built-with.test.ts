import { describe, expect, it } from 'vitest'

import { hubModelSlugs } from '@/config/hub-models'
import type { WorkshopModel } from '@/config/models-catalogue'
import { workshopPages } from '@/config/workshop-page-content'
import { appBuiltWith } from './app-built-with'

const page = (slug: string, href?: string): WorkshopModel => ({
  slug,
  name: slug,
  href,
  routerId: slug,
  workflowCount: 0,
  capabilities: []
})

describe('appBuiltWith', () => {
  it('lists the studio models the Studio runs, once each, skipping any without a page', () => {
    const pages = [
      page('seedream', '/hub/models/seedream/'),
      page('flux', '/hub/models/flux/'),
      page('hidden')
    ]

    expect(
      appBuiltWith('studio', ['flux', 'hidden', 'seedream', 'flux'], pages).map(
        (part) => part.slug
      )
    ).toEqual(['flux', 'seedream'])
  })

  it('gives Re-shoot the workflow built on the model it runs, and no studio models', () => {
    const parts = appBuiltWith(
      'reshoot',
      ['bfl--flux-2-pro--generate-images'],
      workshopPages
    )

    expect(parts.map((part) => part.href)).toEqual([
      '/hub/workflows/video-from-references/'
    ])
  })

  it('links each model it lists to a Hub model page that is built', () => {
    const built = new Set(
      [...hubModelSlugs.values()].map((slug) => `/hub/models/${slug}/`)
    )
    const studio = appBuiltWith(
      'studio',
      workshopPages.map((model) => model.slug),
      workshopPages
    ).filter((part) => part.workflowId === undefined)

    expect(studio.length).toBeGreaterThan(0)
    for (const part of studio) expect(built).toContain(part.href)
  })
})
