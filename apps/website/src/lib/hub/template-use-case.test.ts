import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/workshop'
import { workshopModels } from '../../config/workshop'
import hubTemplates from '../../data/hubTemplates.json'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'
import type { HubTemplate } from './types'

const templates = hubTemplates as HubTemplate[]

function template(tags: string[], models: string[] = []): HubTemplate {
  return {
    name: 'demo',
    title: 'Demo',
    mediaType: 'image',
    tags,
    models,
    logos: [],
    usage: 1,
    date: '2026-01-01',
    thumbnails: [],
    username: 'ComfyUI',
    isApp: false
  }
}

const model = (name: string): WorkshopModel => ({
  slug: 'demo',
  name,
  workflowCount: 1,
  href: '/workshop/models/demo/',
  routerId: `acme/${name}`,
  capabilities: [],
  runs: 10,
  modality: 'video',
  task: 'text-to-video'
})

describe('partnerModelFor', () => {
  it('matches a model by name once punctuation and case are ignored', () => {
    expect(
      partnerModelFor(template(['API'], ['Kling O3']), [model('Kling o3')])
    ).toBeDefined()
  })

  it('refuses a partial name, so a Flux video workflow stays off the Flux image page', () => {
    expect(
      partnerModelFor(template(['API'], ['FLUX 3 Video']), [model('Flux')])
    ).toBeUndefined()
  })

  it('leaves a community workflow alone', () => {
    expect(
      partnerModelFor(template([], ['Kling O3']), [model('Kling O3')])
    ).toBeUndefined()
  })
})

describe('useCaseForTemplate', () => {
  it('reads the task from the most specific tag, not the medium', () => {
    expect(useCaseForTemplate(template(['Video', 'Video Edit']), [])).toBe(
      'edit-videos'
    )
    expect(useCaseForTemplate(template(['Image', 'Inpainting']), [])).toBe(
      'edit-images'
    )
  })

  it('inherits the use case of the partner model when the tags only name a method', () => {
    expect(
      useCaseForTemplate(template(['API', 'LoRA'], ['Kling O3']), [
        model('Kling O3')
      ])
    ).toBe('generate-videos')
  })

  it('falls back to the medium for a conditioning method on its own', () => {
    expect(useCaseForTemplate(template(['ControlNet', 'Video']), [])).toBe(
      'generate-videos'
    )
  })

  it('places all but a handful of the real catalogue', () => {
    const placed = templates.filter((tmpl) =>
      useCaseForTemplate(tmpl, workshopModels)
    )
    expect(placed.length / templates.length).toBeGreaterThan(0.98)
  })
})
