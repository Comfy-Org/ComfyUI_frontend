// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../src/config/models-catalogue'
import type { HubTemplate } from '../src/lib/hub/types'
import { auditCatalogueOverlap } from './audit-catalogue-overlap'

const flux: WorkshopModel = {
  slug: 'bfl--flux--generate-images',
  name: 'Flux',
  workflowCount: 0,
  href: '/models/bfl--flux--generate-images/',
  routerId: 'bfl/flux',
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
) => auditCatalogueOverlap(templates, [flux], details)

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

  it('ranks the most cited models by how many workflows run on them', () => {
    const overlap = audit([
      template(),
      template({ name: 'api_flux_b' }),
      template({ name: 'api_flux_c' })
    ])

    expect(overlap.citedModels).toBe(1)
    expect(overlap.mostCited).toEqual([{ name: 'Flux', count: 3 }])
  })
})
