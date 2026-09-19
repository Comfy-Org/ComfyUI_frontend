import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { ModelEntry } from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'
import { getModelGroupPage, modelGroupFrom } from './model-page'

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
    name: 'poster',
    title: 'Movie poster',
    mediaType: 'image',
    tags: [],
    models: ['Flux'],
    logos: [],
    usage: 10,
    date: '2026-09-10',
    thumbnails: [],
    username: 'Ana',
    isApp: false,
    ...overrides
  }
}

const entry = (workflows: readonly FacetedTemplate[]): ModelEntry => ({
  kind: 'model',
  key: 'bfl--flux',
  model: model(),
  name: 'Flux',
  operations: [model(), model({ slug: 'bfl--flux--edit-images' })],
  workflows
})

const known = new Map([['flux', 'bfl--flux']])

describe('modelGroupFrom', () => {
  it('splits what the model does from what people did with it', () => {
    const page = modelGroupFrom(
      entry([
        template({ name: 'flux_t2i', title: 'Flux: Text to Image' }),
        template({ name: 'poster', title: 'Movie poster' })
      ]),
      known
    )

    expect(page.operationsFromWorkflows.map((t) => t.name)).toEqual([
      'flux_t2i'
    ])
    expect(page.uses.map((t) => t.name)).toEqual(['poster'])
  })

  it('keeps every row the registry lists under the name', () => {
    const page = modelGroupFrom(entry([]), known)

    expect(page).toMatchObject({
      key: 'bfl--flux',
      name: 'Flux',
      provider: 'BFL'
    })
    expect(page.operations).toHaveLength(2)
    expect(page.uses).toEqual([])
    expect(page.operationsFromWorkflows).toEqual([])
  })
})

describe('getModelGroupPage', () => {
  it('has no page for a key the catalogue does not carry', () => {
    expect(getModelGroupPage('hypernova')).toBeUndefined()
  })
})
