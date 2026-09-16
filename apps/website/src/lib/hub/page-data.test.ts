import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import { customNodeNames, relatedCardViews } from './page-data'
import type { HubTemplate, HubTemplateDetails } from './types'

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

function template(overrides: Partial<HubTemplate> = {}): HubTemplate {
  return {
    name: 'poster',
    title: 'Movie poster',
    mediaType: 'image',
    tags: ['Poster'],
    models: [],
    logos: [],
    usage: 10,
    date: '2026-09-10',
    thumbnails: [],
    username: 'Ana',
    isApp: false,
    ...overrides
  }
}

const details = (value: object) => value as HubTemplateDetails

describe('customNodeNames', () => {
  it('names only the workflows whose registry entry asks for an install', () => {
    expect(
      customNodeNames(
        details({
          poster: { requiresCustomNodes: ['comfyui-impact-pack'] },
          plain: { requiresCustomNodes: [] },
          bare: {}
        })
      )
    ).toEqual(new Set(['poster']))
  })
})

describe('relatedCardViews', () => {
  // The strip on a detail page draws the same cards as the grid, so a
  // requirement the grid warns about cannot go quiet here.
  it('carries the custom-node mark onto a related card', () => {
    const [view] = relatedCardViews([template()], [], new Set(['poster']))

    expect(view.needsCustomNodes).toBe(true)
  })

  it('crosses a related card to the model page inside the catalogue', () => {
    const [view] = relatedCardViews(
      [template({ models: ['Flux'], tags: ['API'] })],
      [model()],
      new Set()
    )

    expect(view.crossing).toEqual({
      to: 'model',
      name: 'Flux',
      href: '/models-v2/model/flux/'
    })
  })

  it('reads an app as an app', () => {
    const [view] = relatedCardViews([template({ isApp: true })], [], new Set())

    expect(view.kind).toBe('app')
    expect(view.href).toBe('/models-v2/workflow/poster/')
  })
})
