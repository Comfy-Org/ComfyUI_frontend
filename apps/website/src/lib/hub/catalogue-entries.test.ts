import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import {
  buildCatalogue,
  catalogueNameKeys,
  cheapestOperation,
  entryTitle,
  entryUseCases,
  modelGroupPath,
  ownerOf
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

describe('ownerOf', () => {
  const known = new Set(['flux', 'fluxpro', 'seedance25'])

  it.for([
    ['Flux: Text to Image', ['Flux'], 'flux'],
    // The registry writes the same model both ways, so spacing cannot decide.
    ['Seedance2.5: Video Editing', ['Seedance 2.5'], 'seedance25'],
    // A longer name that also matches is the more specific claim.
    ['Flux Pro: Generate', ['Flux', 'Flux Pro'], 'fluxpro'],
    // The name has to end where a word ends.
    ['Fluxion Portrait', ['Flux'], undefined],
    // Naming a model somewhere in the title is not being titled after it.
    ['A poster, with Flux somewhere', ['Flux'], undefined],
    // A name the catalogue does not carry owns nothing.
    ['Hypernova: Upscale', ['Hypernova'], undefined]
  ] as const)('reads %s as %s', ([title, models, owner]) => {
    expect(ownerOf(template({ title, models: [...models] }), known)).toBe(owner)
  })
})

describe('cheapestOperation', () => {
  it('prices a collapsed name at the cheapest way in', () => {
    const [flux] = buildCatalogue(
      [],
      [
        model({ slug: 'flux--edit', creditsPerRun: 40 }),
        model({ slug: 'flux--generate', creditsPerRun: 12 })
      ]
    )

    expect(flux.kind === 'model' && cheapestOperation(flux).slug).toBe(
      'flux--generate'
    )
  })

  it('falls back to an operation the Router has not priced', () => {
    const [flux] = buildCatalogue([], [model({ slug: 'flux--only' })])

    expect(flux.kind === 'model' && cheapestOperation(flux).slug).toBe(
      'flux--only'
    )
  })
})

describe('catalogueNameKeys', () => {
  it('keys a name by what survives case and punctuation', () => {
    expect(catalogueNameKeys([model({ name: 'Seedance 2.5' })])).toEqual(
      new Set(['seedance25'])
    )
  })
})

describe('modelGroupPath', () => {
  it('addresses a model by its group key, not by an operation slug', () => {
    expect(modelGroupPath('seedance25')).toBe('/playground/model/seedance25/')
  })
})
