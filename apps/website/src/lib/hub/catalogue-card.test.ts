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
  key: 'bfl--flux',
  model: model(),
  name: 'Flux',
  operations: [model()],
  workflows: [],
  ...overrides
})

const workflowEntry = (
  overrides: Partial<Extract<CatalogueEntry, { kind: 'workflow' }>> = {}
): CatalogueEntry => ({
  kind: 'workflow',
  key: 'poster',
  template: template(),
  runsOn: undefined,
  ...overrides
})

const noNodes = new Set<string>()

describe('cardViewFor', () => {
  it('opens a model at its group page rather than at one of its operations', () => {
    const view = cardViewFor(modelEntry(), noNodes)

    expect(view).toMatchObject({
      kind: 'model',
      href: '/playground/model/bfl--flux/',
      title: 'Flux',
      needsCustomNodes: false
    })
    expect(view.maker.label).toBe('BFL')
  })

  it('opens a workflow at the workflow page, never at the model behind it', () => {
    const view = cardViewFor(workflowEntry(), noNodes)

    expect(view).toMatchObject({
      kind: 'workflow',
      href: '/playground/workflow/poster/'
    })
    expect(view.media).toEqual({ url: 'first.png', kind: 'image' })
    expect(view.hoverMedia).toBe('second.png')
  })

  it('marks a workflow that needs custom nodes installed', () => {
    expect(
      cardViewFor(workflowEntry(), new Set(['poster'])).needsCustomNodes
    ).toBe(true)
  })

  it('carries an app through to the card as the workflow it is', () => {
    expect(
      cardViewFor(
        workflowEntry({ template: template({ isApp: true }) }),
        noNodes
      ).kind
    ).toBe('workflow')
  })

  it('shows no media for a workflow with no thumbnail', () => {
    const view = cardViewFor(
      workflowEntry({ template: template({ thumbnails: [] }) }),
      noNodes
    )

    expect(view.media).toBeUndefined()
    expect(view.hoverMedia).toBeUndefined()
  })
})
