import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from './workshop'
import { relatedModels } from './workshop-related'

function model(
  slug: string,
  modality: WorkshopModel['modality'],
  workflowCount: number,
  provider?: string,
  capabilities: readonly string[] = []
): WorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount,
    href: `/${slug}`,
    routerId: `x/${slug}`,
    capabilities,
    runs: 12_000,
    modality,
    ...(provider ? { provider } : {})
  }
}

const catalog = [
  model('current', 'video', 9),
  model('busy-image', 'image', 8),
  model('quiet-video', 'video', 1),
  model('busy-video', 'video', 5),
  model('audio', 'audio', 7),
  model('other-image', 'image', 2)
]

const withProviders = [
  model('hailuo-03', 'video', 9, 'MiniMax'),
  model('busy-video', 'video', 8),
  model('hailuo-02', 'video', 2, 'MiniMax'),
  model('hailuo-i2v', 'image', 1, 'MiniMax')
]

describe('relatedModels', () => {
  it('lists the same modality first, most used first, without the model itself', () => {
    expect(relatedModels(catalog[0], catalog).map((m) => m.slug)).toEqual([
      'busy-video',
      'quiet-video',
      'busy-image',
      'audio'
    ])
  })

  it('puts the other models of the same provider first', () => {
    expect(
      relatedModels(withProviders[0], withProviders).map((m) => m.slug)
    ).toEqual(['hailuo-02', 'hailuo-i2v', 'busy-video'])
  })

  it('tops the row up with the nearest capability when the provider runs out', () => {
    const models = [
      model('current', 'video', 9, 'MiniMax', ['Lip sync']),
      model('popular-stranger', 'video', 8),
      model('lip-sync-stranger', 'video', 2, undefined, ['Lip sync'])
    ]

    expect(relatedModels(models[0], models).map((m) => m.slug)).toEqual([
      'lip-sync-stranger',
      'popular-stranger'
    ])
  })

  it('honours the limit', () => {
    expect(relatedModels(catalog[0], catalog, 2).map((m) => m.slug)).toEqual([
      'busy-video',
      'quiet-video'
    ])
  })
})
