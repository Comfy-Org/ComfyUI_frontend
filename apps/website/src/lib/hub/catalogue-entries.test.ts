import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import {
  buildCatalogue,
  catalogueNameIndex,
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
  // The registry names a row after its operation, so the two halves of one
  // model never share a name; what they share is the model half of the slug.
  it('collapses the operations of one model into one card', () => {
    const entries = buildCatalogue(
      [],
      [
        model({
          slug: 'bfl--flux--generate-images',
          name: 'Flux Text-to-Image',
          modality: 'image'
        }),
        model({
          slug: 'bfl--flux--edit-images',
          name: 'Flux Image Edit',
          task: 'image-to-image',
          modality: 'image'
        }),
        model({ slug: 'bfl--kontext--edit-images', name: 'Kontext' })
      ]
    )

    expect(titles(entries)).toEqual(['Flux', 'Kontext'])
    const flux = entries[0]
    expect(flux.kind === 'model' && flux.operations).toHaveLength(2)
  })

  it('answers to every use case the collapsed operations cover', () => {
    const models = [
      model({
        slug: 'bfl--flux--generate-images',
        name: 'Flux Text-to-Image',
        modality: 'image'
      }),
      model({
        slug: 'bfl--flux--edit-images',
        name: 'Flux Image Edit',
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

  // A model card and a workflow card never share a list, so a workflow named
  // after the model it runs cannot read as a second product with that name.
  // It browses with the other workflows and still counts on the model's page.
  it('browses a workflow titled after a model, and counts it on the model', () => {
    const entries = buildCatalogue(
      [
        template({ name: 'flux_t2i', title: 'Flux: Text to Image' }),
        template({ name: 'poster', title: 'Make a movie poster' })
      ],
      [model()]
    )

    expect(titles(entries)).toEqual([
      'Flux',
      'Flux: Text to Image',
      'Make a movie poster'
    ])
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

  // An app is a graph somebody wrapped in a form. Showing it as a second kind
  // beside the graph offers the reader the same thing twice.
  it('browses an app as the workflow it is', () => {
    const entries = buildCatalogue(
      [
        template({ name: 'studio', title: 'Studio', isApp: true }),
        template({ name: 'graph', title: 'Graph' })
      ],
      []
    )

    expect(entries.map((entry) => entry.kind)).toEqual(['workflow', 'workflow'])
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
  const known = new Map([
    ['flux', 'bfl--flux'],
    ['fluxpro', 'bfl--flux-pro'],
    ['seedance25', 'byteplus--seedance-2-5']
  ])

  it.for([
    ['Flux: Text to Image', ['Flux'], 'bfl--flux'],
    // The registry writes the same model both ways, so spacing cannot decide.
    ['Seedance2.5: Video Editing', ['Seedance 2.5'], 'byteplus--seedance-2-5'],
    // A longer name that also matches is the more specific claim.
    ['Flux Pro: Generate', ['Flux', 'Flux Pro'], 'bfl--flux-pro'],
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
        model({ slug: 'bfl--flux--edit-images', creditsPerRun: 40 }),
        model({ slug: 'bfl--flux--generate-images', creditsPerRun: 12 })
      ]
    )

    expect(flux.kind === 'model' && cheapestOperation(flux).slug).toBe(
      'bfl--flux--generate-images'
    )
  })

  it('falls back to an operation the Router has not priced', () => {
    const [flux] = buildCatalogue(
      [],
      [model({ slug: 'bfl--flux--generate-images' })]
    )

    expect(flux.kind === 'model' && cheapestOperation(flux).slug).toBe(
      'bfl--flux--generate-images'
    )
  })
})

describe('catalogueNameIndex', () => {
  // A workflow written before the rename still says "Seedance 2.5", and one
  // written after says "Seedance 2.5 Text-to-Image"; both mean this model.
  it('answers to the model name and to each operation name', () => {
    const index = catalogueNameIndex([
      model({
        slug: 'byteplus--seedance-2-5--generate-videos',
        name: 'Seedance 2.5 Text-to-Video'
      }),
      model({
        slug: 'byteplus--seedance-2-5--edit-videos',
        name: 'Seedance 2.5 Video Edit'
      })
    ])

    expect(index.get('seedance25')).toBe('byteplus--seedance-2-5')
    expect(index.get('seedance25texttovideo')).toBe('byteplus--seedance-2-5')
  })
})

describe('modelGroupPath', () => {
  it('addresses a model by its group key, not by an operation slug', () => {
    expect(modelGroupPath('seedance25')).toBe('/hub/model/seedance25/')
  })
})
