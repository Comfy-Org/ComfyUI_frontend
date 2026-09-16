import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import {
  buildCatalogue,
  entryTitle,
  entryUseCases,
  sortCatalogue
} from './catalogue-entries'
import type { CatalogueEntry } from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'

function model(overrides: Partial<WorkshopModel> = {}): WorkshopModel {
  return {
    slug: 'bfl--flux--generate-images',
    name: 'Flux',
    workflowCount: 0,
    href: '/workshop/models/bfl--flux--generate-images/',
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

const titles = (entries: readonly CatalogueEntry[]) => entries.map(entryTitle)

describe('buildCatalogue', () => {
  it('collapses a name the registry lists once per operation into one card', () => {
    const entries = buildCatalogue(
      [],
      [
        model({ slug: 'flux--generate', name: 'Flux', modality: 'image' }),
        model({
          slug: 'flux--edit',
          name: 'Flux',
          task: 'image-to-image',
          modality: 'image'
        }),
        model({ slug: 'kontext', name: 'Kontext' })
      ]
    )

    expect(titles(entries)).toEqual(['Flux', 'Kontext'])
    const flux = entries[0]
    expect(flux.kind === 'model' && flux.operations).toHaveLength(2)
  })

  it('answers to every use case the collapsed operations cover', () => {
    const models = [
      model({ slug: 'flux--generate', name: 'Flux', modality: 'image' }),
      model({
        slug: 'flux--edit',
        name: 'Flux',
        modality: 'image',
        task: 'image-to-image'
      })
    ]
    const entries = buildCatalogue([], models)

    expect(entryUseCases(entries[0], models)).toEqual([
      'generate-images',
      'edit-images'
    ])
  })

  it('folds a workflow titled after a model it names onto that model', () => {
    const entries = buildCatalogue(
      [
        template({ name: 'flux_t2i', title: 'Flux: Text to Image' }),
        template({ name: 'poster', title: 'Make a movie poster' })
      ],
      [model()]
    )

    expect(titles(entries)).toEqual(['Flux', 'Make a movie poster'])
    const flux = entries[0]
    expect(flux.kind === 'model' && flux.workflows.map((w) => w.name)).toEqual([
      'flux_t2i',
      'poster'
    ])
  })

  it('keeps a workflow that only mentions a model in the grid', () => {
    const entries = buildCatalogue(
      [template({ name: 'poster', title: 'A poster, with Flux somewhere' })],
      [model()]
    )

    expect(titles(entries)).toContain('A poster, with Flux somewhere')
  })

  it('marks an app apart from a node graph', () => {
    const entries = buildCatalogue(
      [
        template({ name: 'studio', title: 'Studio', isApp: true }),
        template({ name: 'graph', title: 'Graph' })
      ],
      []
    )

    expect(entries.map((entry) => entry.kind)).toEqual(['app', 'workflow'])
  })

  it('opens a workflow at the model page only when one is safe', () => {
    const entries = buildCatalogue(
      [
        template({ name: 'routed', title: 'A routed one' }),
        template({
          name: 'unknown',
          title: 'Something else',
          models: ['Hypernova']
        })
      ],
      [model()]
    )
    const [routed, unknown] = entries.filter((entry) => entry.kind !== 'model')

    expect(routed.runsOn?.name).toBe('Flux')
    expect(unknown.runsOn).toBeUndefined()
  })
})

describe('sortCatalogue', () => {
  const entries = buildCatalogue(
    [
      template({
        name: 'a',
        title: 'Zebra graph',
        usage: 5,
        date: '2026-01-01'
      }),
      template({
        name: 'b',
        title: 'Alpha graph',
        usage: 90,
        date: '2026-08-01'
      })
    ],
    [model({ name: 'Mid model', recommendedRank: 2 })]
  )

  it('reads capabilities first, since the two standings share no scale', () => {
    expect(titles(sortCatalogue(entries, 'popular'))).toEqual([
      'Mid model',
      'Alpha graph',
      'Zebra graph'
    ])
  })

  it('mixes both kinds when the order is one they both answer', () => {
    expect(titles(sortCatalogue(entries, 'name'))).toEqual([
      'Alpha graph',
      'Mid model',
      'Zebra graph'
    ])
  })

  it('puts a dateless model last when the order is by date', () => {
    expect(titles(sortCatalogue(entries, 'newest'))).toEqual([
      'Alpha graph',
      'Zebra graph',
      'Mid model'
    ])
  })
})
