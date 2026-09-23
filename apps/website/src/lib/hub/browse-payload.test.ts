import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { BrowseEntry } from './browse-entry'
import { sortBrowseEntries } from './browse-entry'
import { browseEntries } from './browse-payload'
import type { FacetedTemplate } from './facet-fields'

function model(overrides: Partial<WorkshopModel> = {}): WorkshopModel {
  return {
    slug: 'bfl--flux--generate-images',
    name: 'Flux',
    workflowCount: 0,
    href: '/models/bfl--flux--generate-images/',
    routerId: 'bfl/flux',
    provider: 'BFL',
    modality: 'image',
    capabilities: [],
    ...overrides
  }
}

function template(overrides: Partial<FacetedTemplate> = {}): FacetedTemplate {
  return {
    name: 'api_flux_t2i',
    title: 'Flux: Text to Image',
    mediaType: 'image',
    tags: ['API', 'Text to Image'],
    models: ['Flux'],
    logos: [],
    usage: 10,
    date: '2026-09-10',
    thumbnails: [],
    username: 'Comfy',
    isApp: false,
    ...overrides
  }
}

const build = (
  templates: readonly FacetedTemplate[],
  models: readonly WorkshopModel[]
) => browseEntries(templates, models)

const titles = (entries: readonly BrowseEntry[]) =>
  entries.map((entry) => entry.title)

describe('browseEntries', () => {
  it('sends the card and what the browser reads, and no catalogue rows', () => {
    const [entry] = build([], [model({ recommendedRank: 3 })])

    expect(entry).toEqual({
      key: 'bfl--flux',
      kind: 'model',
      title: 'Flux',
      shelves: ['generate-images'],
      models: [],
      tags: [],
      standing: 3,
      date: undefined,
      card: expect.objectContaining({
        kind: 'model',
        href: '/hub/model/bfl--flux/'
      })
    })
  })

  // A workflow the shared Cloud endpoint cannot run is the one thing a card
  // has to say, and it is read off the packs the graph names rather than
  // handed in, so a card cannot disagree with the page behind it.
  it('marks a workflow the shared endpoint cannot run', () => {
    const [entry] = build(
      [
        template({
          name: 'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
          title: 'Remove an object'
        })
      ],
      []
    )

    expect(entry.card.reach).toBe('endpoint')
  })

  it('leaves an ordinary Cloud workflow unmarked beyond where it runs', () => {
    const [entry] = build([template()], [])

    expect(entry.card.reach).toBe('cloud')
  })
})

describe('sortBrowseEntries', () => {
  const entries = build(
    [
      template({
        name: 'a',
        title: 'Zebra graph',
        usage: 5,
        date: '2026-01-01',
        models: []
      }),
      template({
        name: 'b',
        title: 'Alpha graph',
        usage: 90,
        date: '2026-08-01',
        models: []
      })
    ],
    [model({ name: 'Mid model', recommendedRank: 2 })]
  )

  it('reads capabilities first, since the two standings share no scale', () => {
    expect(titles(sortBrowseEntries(entries, 'popular'))).toEqual([
      'Mid model',
      'Alpha graph',
      'Zebra graph'
    ])
  })

  it('mixes both kinds when the order is one they both answer', () => {
    expect(titles(sortBrowseEntries(entries, 'name'))).toEqual([
      'Alpha graph',
      'Mid model',
      'Zebra graph'
    ])
  })

  it('puts a dateless model last when the order is by date', () => {
    expect(titles(sortBrowseEntries(entries, 'newest'))).toEqual([
      'Alpha graph',
      'Zebra graph',
      'Mid model'
    ])
  })
})
