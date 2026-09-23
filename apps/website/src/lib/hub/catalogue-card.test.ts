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

describe('cardViewFor', () => {
  it('opens a model at its group page rather than at one of its operations', () => {
    const view = cardViewFor(modelEntry())

    expect(view).toMatchObject({
      kind: 'model',
      href: '/hub/model/bfl--flux/',
      title: 'Flux',
      reach: undefined
    })
    expect(view.maker.label).toBe('BFL')
  })

  it('opens a workflow at the workflow page, never at the model behind it', () => {
    const view = cardViewFor(workflowEntry())

    expect(view).toMatchObject({
      kind: 'workflow',
      href: '/hub/workflow/poster/'
    })
    expect(view.media).toEqual({ url: 'first.png', kind: 'image' })
    expect(view.hoverMedia).toBe('second.png')
  })

  it('carries an app through to the card as the workflow it is', () => {
    expect(
      cardViewFor(workflowEntry({ template: template({ isApp: true }) })).kind
    ).toBe('workflow')
  })

  // Once the title names the job, who answers for it is what tells one card
  // from the next, so it rides over the artwork rather than in the title.
  it('marks a workflow with the model it runs on', () => {
    expect(cardViewFor(workflowEntry({ runsOn: model() })).mark.label).toBe(
      'Flux'
    )
  })

  it('marks a model with its provider', () => {
    expect(cardViewFor(modelEntry()).mark.label).toBe('BFL')
  })

  it('shows no media for a workflow with no thumbnail', () => {
    const view = cardViewFor(
      workflowEntry({ template: template({ thumbnails: [] }) })
    )

    expect(view.media).toBeUndefined()
    expect(view.hoverMedia).toBeUndefined()
  })
})
