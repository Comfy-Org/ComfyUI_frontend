import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/models-catalogue'
import hubTemplates from '../../data/hubTemplates.json'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'
import type { HubTemplate } from './types'

const templates = hubTemplates as HubTemplate[]

function template(
  tags: string[],
  models: string[] = [],
  mediaType: HubTemplate['mediaType'] = 'image'
): HubTemplate {
  return {
    name: 'demo',
    title: 'Demo',
    mediaType,
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
  href: '/models/demo/',
  routerId: `acme/${name}`,
  capabilities: [],
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

  it('does not send a Pro workflow to a Lite model through a provider-family guess', () => {
    const tmpl = { ...template(['API']), name: 'api_bytedance_text_to_video' }
    expect(partnerModelFor(tmpl, workshopModels)).toBeUndefined()
  })

  it('has no join row for a workflow that disagreed on the medium', () => {
    const tmpl = { ...template(['API']), name: 'api_topaz_video_enhance' }
    expect(partnerModelFor(tmpl, workshopModels)).toBeUndefined()
  })

  it('links create and edit workflows to their own content pages for the same Router model', () => {
    const create: WorkshopModel = {
      ...model('Demo'),
      slug: 'demo--generate-images',
      useCases: ['generate-images']
    }
    const edit: WorkshopModel = {
      ...model('Demo'),
      slug: 'demo--edit-images',
      useCases: ['edit-images']
    }
    expect(
      partnerModelFor(template(['API', 'Text to Image'], ['Demo']), [
        edit,
        create
      ])
    ).toBe(create)
    expect(
      partnerModelFor(template(['API', 'Image Edit'], ['Demo']), [create, edit])
    ).toBe(edit)
  })

  it('leaves a community workflow alone', () => {
    expect(
      partnerModelFor(template([], ['Kling O3']), [model('Kling O3')])
    ).toBeUndefined()
  })

  it('does not pick the first of duplicate normalized names', () => {
    expect(
      partnerModelFor(template(['API'], ['Kling O3']), [
        model('Kling O3'),
        { ...model('Kling-o3'), slug: 'different-model' }
      ])
    ).toBeUndefined()
  })

  it('rejects conflicting task tags rather than choosing their order', () => {
    expect(
      partnerModelFor(
        template(['API', 'Text to Video', 'Video Edit'], ['Demo']),
        [model('Demo')]
      )
    ).toBeUndefined()
  })

  it('checks a generated target against the operation and requires a unique page', () => {
    const create: WorkshopModel = {
      ...model('Create'),
      slug: 'create',
      routerId: 'acme/shared',
      useCases: ['generate-images']
    }
    const edit: WorkshopModel = {
      ...create,
      name: 'Edit',
      slug: 'edit',
      useCases: ['edit-images']
    }
    const tmpl = template(['API', 'Image Edit'])
    expect(partnerModelFor(tmpl, [create, edit], 'create')).toBeUndefined()
    expect(partnerModelFor(tmpl, [create, edit], 'edit')).toBe(edit)
    expect(
      partnerModelFor(tmpl, [edit, { ...edit, name: 'Duplicate slug' }], 'edit')
    ).toBeUndefined()
    expect(
      partnerModelFor(template(['API', 'Text Generation']), [create], 'create')
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

  it('falls back to what the workflow outputs when the tags only name a method', () => {
    expect(useCaseForTemplate(template(['ControlNet'], [], 'video'), [])).toBe(
      'generate-videos'
    )
    expect(useCaseForTemplate(template(['ControlNet'], [], 'image'), [])).toBe(
      'generate-images'
    )
  })

  it('places every workflow in the real catalogue', () => {
    const unplaced = templates.filter(
      (tmpl) => useCaseForTemplate(tmpl, workshopModels) === undefined
    )
    expect(unplaced).toEqual([])
  })
})
