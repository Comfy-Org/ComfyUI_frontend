import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import {
  facetedTemplates,
  priceBySlug,
  pricedOperations,
  relatedCardViews
} from './page-data'
import type { HubTemplate } from './types'

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

describe('relatedCardViews', () => {
  it('reads an app as the workflow it is', () => {
    const [view] = relatedCardViews([template({ isApp: true })], [])

    expect(view.kind).toBe('workflow')
    expect(view.href).toBe('/hub/workflow/poster/')
  })
})

describe('facetedTemplates', () => {
  it('reads a template against the catalogue it will browse beside', () => {
    const [faceted] = facetedTemplates(
      [template({ models: ['Flux'], tags: ['API'], title: '  Spaced  ' })],
      [model()]
    )

    expect(faceted.title).toBe('Spaced')
    expect(faceted.partner).toBe('BFL')
  })

  it('refuses a registry that does not match the schema', () => {
    expect(() => facetedTemplates([{ name: 'broken' }], [])).toThrow()
  })
})

describe('priceBySlug', () => {
  // The grid looks a price up by slug, so an operation the Router leaves
  // unpriced has to be absent rather than present and empty.
  it('keys the priced by slug and leaves the unpriced out', async () => {
    const prices = await priceBySlug(
      [
        model({ slug: 'flux--generate' }),
        model({ slug: 'flux--edit' }),
        model({ slug: 'flux--unpriced' })
      ],
      async (candidate) =>
        candidate.slug === 'flux--unpriced'
          ? undefined
          : `${candidate.slug} fee`
    )

    expect([...prices]).toEqual([
      ['flux--generate', 'flux--generate fee'],
      ['flux--edit', 'flux--edit fee']
    ])
  })
})

describe('pricedOperations', () => {
  it('gives every operation its task and its own price', async () => {
    const rows = await pricedOperations(
      [
        model({ slug: 'flux--generate', task: 'text-to-image' }),
        model({ slug: 'flux--edit', task: 'image-to-image' })
      ],
      async (candidate) =>
        candidate.slug === 'flux--edit' ? undefined : '12 credits'
    )

    expect(rows.map((row) => row.model.slug)).toEqual([
      'flux--generate',
      'flux--edit'
    ])
    expect(rows.map((row) => row.price)).toEqual(['12 credits', undefined])
    expect(rows.every((row) => row.task.length > 0)).toBe(true)
  })
})
