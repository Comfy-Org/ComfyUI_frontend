import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from './workshop'
import { relatedModels } from './workshop-related'

function model(
  slug: string,
  modality: WorkshopModel['modality'],
  workflowCount: number
): WorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount,
    href: `/${slug}`,
    routerId: `x/${slug}`,
    capabilities: [],
    runs: 12_000,
    modality
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

describe('relatedModels', () => {
  it('lists the same modality first, most used first, without the model itself', () => {
    expect(relatedModels(catalog[0], catalog).map((m) => m.slug)).toEqual([
      'busy-video',
      'quiet-video',
      'busy-image',
      'audio'
    ])
  })

  it('honours the limit', () => {
    expect(relatedModels(catalog[0], catalog, 2).map((m) => m.slug)).toEqual([
      'busy-video',
      'quiet-video'
    ])
  })
})
