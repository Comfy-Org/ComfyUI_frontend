import { describe, expect, it } from 'vitest'

import { familyOf, groupByFamily } from './model-family'
import type { WorkshopModel } from './workshop'

function model(
  name: string,
  slug: string,
  extra: Partial<WorkshopModel> = {}
): WorkshopModel {
  return {
    slug,
    name,
    workflowCount: 1,
    href: `/workshop/models/${slug}/`,
    routerId: `provider/${slug}`,
    provider: 'Alibaba',
    capabilities: [],
    runs: 0,
    ...extra
  }
}

describe('groupByFamily', () => {
  it('collapses the releases of one model into a family, newest first', () => {
    const families = groupByFamily([
      model('Wan 2.6', 'wan2-6'),
      model('Wan', 'wan-api'),
      model('Wan 3.0', 'wan-3-0')
    ])

    expect(families).toHaveLength(1)
    expect(families[0].name).toBe('Wan')
    expect(families[0].latest.slug).toBe('wan-3-0')
    expect(families[0].versions.map((version) => version.name)).toEqual([
      'Wan 3.0',
      'Wan 2.6',
      'Wan'
    ])
  })

  it('keeps the same name under two providers apart', () => {
    const families = groupByFamily([
      model('Sora 2', 'sora', { provider: 'OpenAI' }),
      model('Sora 2', 'sora-cn', { provider: 'Kling' })
    ])

    expect(families).toHaveLength(2)
  })

  it('shows a release the registry lists twice only once', () => {
    const families = groupByFamily([
      model('Flux', 'flux', { workflowCount: 9 }),
      model('Flux', 'flux-api', { workflowCount: 2 })
    ])

    expect(families[0].versions.map((version) => version.slug)).toEqual([
      'flux'
    ])
  })

  it('orders families by the first model it was given', () => {
    const families = groupByFamily([
      model('Veo 2', 'veo-2'),
      model('Wan 3.0', 'wan-3-0'),
      model('Veo 3', 'veo-3')
    ])

    expect(families.map((family) => family.name)).toEqual(['Veo', 'Wan'])
  })
})

describe('familyOf', () => {
  it('finds the family of a release the switcher no longer lists', () => {
    const models = [
      model('Flux', 'flux', { workflowCount: 9 }),
      model('Flux', 'flux-api', { workflowCount: 2 })
    ]

    expect(familyOf(models, 'flux-api')?.latest.slug).toBe('flux')
    expect(familyOf(models, 'nope')).toBeUndefined()
  })
})
