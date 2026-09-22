// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../src/config/models-catalogue'
import type { HubTemplate } from '../src/lib/hub/types'
import {
  auditCatalogueOverlap,
  reportCatalogueOverlap
} from './audit-catalogue-overlap'

const flux: WorkshopModel = {
  slug: 'bfl--flux--generate-images',
  name: 'Flux',
  workflowCount: 0,
  href: '/models/bfl--flux--generate-images/',
  routerId: 'bfl/flux',
  modality: 'image',
  capabilities: []
}

const kontext: WorkshopModel = {
  slug: 'bfl--kontext--generate-images',
  name: 'Kontext',
  workflowCount: 0,
  href: '/models/bfl--kontext--generate-images/',
  routerId: 'bfl/kontext',
  modality: 'image',
  capabilities: []
}

function template(overrides: Partial<HubTemplate> = {}): HubTemplate {
  return {
    name: 'api_flux_t2i',
    title: 'Flux: Text to Image',
    mediaType: 'image',
    tags: ['API', 'Text to Image'],
    models: ['Flux'],
    logos: [],
    usage: 1,
    date: '2026-09-10',
    thumbnails: [],
    username: 'Comfy',
    isApp: false,
    ...overrides
  }
}

const audit = (
  templates: readonly HubTemplate[],
  details: Record<string, { requiresCustomNodes?: readonly string[] }> = {}
) => auditCatalogueOverlap(templates, [flux, kontext], details)

describe('auditCatalogueOverlap', () => {
  it('counts what the site can run here, apps apart from the rest', () => {
    const overlap = audit([
      template(),
      template({ name: 'api_flux_app', title: 'Flux studio', isApp: true }),
      template({
        name: 'local_upscale',
        title: 'Upscale a photo',
        tags: ['Image'],
        models: []
      })
    ])

    expect(overlap.templates).toBe(3)
    expect(overlap.apps).toBe(1)
    expect(overlap.runnable).toBe(2)
    expect(overlap.runnableApps).toBe(1)
  })

  it('counts a workflow that names a model it cannot be routed to', () => {
    const overlap = audit([
      template(),
      template({ name: 'local_flux_lora', title: 'Flux LoRA', tags: ['Image'] })
    ])

    expect(overlap.runnable).toBe(1)
    expect(overlap.mentioning).toBe(2)
    expect(overlap.mentionedModels).toBe(1)
  })

  it('names the model a workflow collides with, letter for letter', () => {
    const overlap = audit([
      template({ name: 'api_flux', title: 'Flux' }),
      template({ name: 'api_flux_pro', title: 'Flux Pro' })
    ])

    expect(overlap.titleCollisions).toEqual(['Flux'])
  })

  it('separates a title that opens with its model from one that does not', () => {
    const overlap = audit([
      template(),
      template({ name: 'api_flux_poster', title: 'Make a movie poster' })
    ])

    expect(overlap.runnable).toBe(2)
    expect(overlap.echoes).toBe(1)
  })

  it('counts a workflow as needing custom nodes only when it lists any', () => {
    const overlap = audit(
      [template(), template({ name: 'api_flux_kontext' })],
      {
        api_flux_t2i: { requiresCustomNodes: ['comfyui-kjnodes'] },
        api_flux_kontext: { requiresCustomNodes: [] }
      }
    )

    expect(overlap.needCustomNodes).toBe(1)
  })

  it('tallies the use cases and keeps the workflows it could not place', () => {
    const overlap = audit([
      template(),
      template({ name: 'api_flux_edit', tags: ['API', 'Image Edit'] })
    ])

    expect(overlap.useCases).toEqual(
      expect.arrayContaining([
        { name: 'edit-images', count: 1 },
        { name: 'generate-images', count: 1 }
      ])
    )
    expect(overlap.useCases).toHaveLength(2)
    expect(overlap.unclassified).toEqual([])
  })

  it('ranks the cited models, most run on first', () => {
    const overlap = audit([
      template(),
      template({ name: 'api_flux_b' }),
      template({
        name: 'api_kontext',
        title: 'Kontext: Text to Image',
        models: ['Kontext']
      })
    ])

    expect(overlap.citedModels).toBe(2)
    expect(overlap.mostCited).toEqual([
      { name: 'Flux', count: 2 },
      { name: 'Kontext', count: 1 }
    ])
  })

  it('ranks the named models separately from the ones it can route to', () => {
    const overlap = audit([
      template(),
      template({
        name: 'local_flux_lora',
        title: 'Flux LoRA',
        tags: ['Image']
      }),
      template({
        name: 'api_kontext',
        title: 'Kontext: Text to Image',
        models: ['Kontext']
      })
    ])

    expect(overlap.mostCited).toEqual([
      { name: 'Flux', count: 1 },
      { name: 'Kontext', count: 1 }
    ])
    expect(overlap.mostMentioned).toEqual([
      { name: 'Flux', count: 2 },
      { name: 'Kontext', count: 1 }
    ])
  })

  it('separates an API workflow the catalogue cannot receive from one it can', () => {
    const overlap = audit([
      template(),
      template({
        name: 'api_unknown',
        title: 'Hypernova: Text to Image',
        models: ['Hypernova']
      }),
      template({
        name: 'api_two_tasks',
        title: 'Flux: anything',
        tags: ['API', 'Text to Image', 'Image Edit']
      }),
      template({ name: 'local_upscale', title: 'Upscale', tags: ['Image'] })
    ])

    expect(overlap.apiWorkflows).toBe(3)
    expect(overlap.apiRoutable).toBe(1)
    expect(overlap.apiOffCatalogue).toBe(1)
    expect(overlap.apiAmbiguous).toBe(1)
    // The three are the whole of the API workflows, and each one is counted
    // once: the split is a partition, not three overlapping questions.
    expect(
      overlap.apiRoutable + overlap.apiOffCatalogue + overlap.apiAmbiguous
    ).toBe(overlap.apiWorkflows)
  })

  it('reports a share of nothing as nothing, not as NaN', () => {
    expect(reportCatalogueOverlap(audit([]))).toContain(
      'runnable here 0 (0.0%)'
    )
  })

  it('keeps a title that only differs in case out of the collisions', () => {
    const overlap = audit([
      template({ name: 'api_flux_exact', title: 'Flux' }),
      template({ name: 'api_flux_cased', title: 'FLUX' })
    ])

    expect(overlap.titleCollisions).toEqual(['Flux'])
    expect(overlap.nearMissTitles).toEqual(['FLUX'])
  })
})
