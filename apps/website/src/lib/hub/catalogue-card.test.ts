import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import { cardViewFor } from './catalogue-card'
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
    capabilities: ['text to image'],
    ...overrides
  }
}

function template(overrides: Partial<FacetedTemplate> = {}): FacetedTemplate {
  return {
    name: 'poster',
    title: 'Movie poster',
    mediaType: 'image',
    tags: ['Poster'],
    models: [],
    logos: [],
    usage: 10,
    date: '2026-09-10',
    thumbnails: ['first.png', 'second.png'],
    username: 'Ana',
    isApp: false,
    ...overrides
  }
}

const modelEntry = (
  overrides: Partial<Extract<CatalogueEntry, { kind: 'model' }>> = {}
): CatalogueEntry => ({
  kind: 'model',
  key: 'flux',
  model: model(),
  operations: [model()],
  workflows: [],
  ...overrides
})

const workflowEntry = (
  overrides: Partial<Extract<CatalogueEntry, { kind: 'workflow' | 'app' }>> = {}
): CatalogueEntry => ({
  kind: 'workflow',
  key: 'poster',
  template: template(),
  runsOn: undefined,
  ...overrides
})

const noNodes = new Set<string>()
const noPrices = new Map<string, string>()

describe('cardViewFor', () => {
  it('opens a model at its group page and prices it from the registry', () => {
    const view = cardViewFor(
      modelEntry(),
      noNodes,
      new Map([['bfl--flux--generate-images', '12 credits']])
    )

    expect(view).toMatchObject({
      kind: 'model',
      href: '/playground/model/flux/',
      title: 'Flux',
      price: '12 credits',
      needsCustomNodes: false
    })
    expect(view.maker.label).toBe('BFL')
  })

  // One card stands for every operation under the name, so the first row the
  // registry happens to list is not the one a reader decides on.
  it('prices a collapsed name at its cheapest operation', () => {
    const view = cardViewFor(
      modelEntry({
        model: model({ slug: 'flux--edit', creditsPerRun: 40 }),
        operations: [
          model({ slug: 'flux--edit', creditsPerRun: 40 }),
          model({ slug: 'flux--generate', creditsPerRun: 12 })
        ]
      }),
      noNodes,
      new Map([
        ['flux--edit', '40 credits'],
        ['flux--generate', '12 credits']
      ])
    )

    expect(view.price).toBe('12 credits')
  })

  it('opens a workflow at the workflow page, never at the model behind it', () => {
    const view = cardViewFor(workflowEntry(), noNodes, noPrices)

    expect(view).toMatchObject({
      kind: 'workflow',
      href: '/playground/workflow/poster/',
      price: undefined
    })
    expect(view.media).toEqual({ url: 'first.png', kind: 'image' })
    expect(view.hoverMedia).toBe('second.png')
  })

  it('marks a workflow that needs custom nodes installed', () => {
    expect(
      cardViewFor(workflowEntry(), new Set(['poster']), noPrices)
        .needsCustomNodes
    ).toBe(true)
  })

  it('carries the app kind through to the card', () => {
    expect(
      cardViewFor(
        workflowEntry({ kind: 'app', template: template({ isApp: true }) }),
        noNodes,
        noPrices
      ).kind
    ).toBe('app')
  })

  it('shows no media for a workflow with no thumbnail', () => {
    const view = cardViewFor(
      workflowEntry({ template: template({ thumbnails: [] }) }),
      noNodes,
      noPrices
    )

    expect(view.media).toBeUndefined()
    expect(view.hoverMedia).toBeUndefined()
  })
})
