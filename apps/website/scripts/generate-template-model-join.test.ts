import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../src/config/models-catalogue'
import { workshopModels } from '../src/config/models-catalogue'
import hubTemplates from '../src/data/hubTemplates.json'
import templateModelJoin from '../src/data/templateModelJoin.json'
import {
  partnerModelFor,
  useCaseForTemplate
} from '../src/lib/hub/template-use-case'
import { hubTemplatesSchema } from '../src/lib/hub/types'
import type { HubTemplate } from '../src/lib/hub/types'
import { buildTemplateModelJoin } from './generate-template-model-join'

const model: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 1,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  modality: 'image',
  capabilities: []
}

function template(name: string): HubTemplate {
  return {
    name,
    title: name,
    mediaType: 'image',
    tags: ['API'],
    models: [],
    logos: [],
    usage: 1,
    date: '2026-09-10',
    thumbnails: [],
    username: 'Comfy',
    isApp: false
  }
}

describe('buildTemplateModelJoin', () => {
  it('requires a complete provider prefix token', () => {
    const result = buildTemplateModelJoin(
      [
        template('api_flux'),
        template('api_flux_task'),
        template('api_fluxible_task')
      ],
      [model]
    )

    expect(result.joined).toEqual({
      api_flux: 'flux',
      api_flux_task: 'flux'
    })
  })

  it('rejects an invalid template snapshot before joining', () => {
    expect(() =>
      buildTemplateModelJoin(
        [{ ...template('api_flux_task'), models: 42 }],
        [model]
      )
    ).toThrow()
  })

  it('keeps HappyHorse operations and versions distinct and never links chat to an image model', () => {
    const templates = hubTemplatesSchema.parse(hubTemplates)
    const { joined } = buildTemplateModelJoin(templates)
    const expected = {
      api_happyhorse1_1_i2v: 'wan--happyhorse-image-to-video--animate-images',
      api_happyhorse1_1_r2v: 'wan--happyhorse-reference-video--animate-images',
      api_happyhorse1_1_t2v: 'wan--happyhorse-text-to-video--generate-videos',
      api_happyhorse1_0_video_edit: 'wan--happyhorse-video-edit--edit-videos'
    }
    for (const [name, slug] of Object.entries(expected)) {
      expect(joined[name]).toBe(slug)
      const row = templates.find((row) => row.name === name)
      expect(row).toBeDefined()
      if (!row) throw new Error(`Missing template ${name}`)
      expect(partnerModelFor(row, workshopModels)?.slug).toBe(slug)
    }
    for (const name of [
      'api_happyhorse1_0_i2v',
      'api_happyhorse1_0_r2v',
      'api_happyhorse1_0_t2v',
      'api_openai_chat',
      'api_bytedance_text_to_video',
      'api_bytedance_seedance1_5_text_to_video',
      'api_kling_motion_control',
      'api_kling_omni_t2v',
      'api_luma_ray3_3_t2v',
      'api_bria_remove_video_background'
    ]) {
      expect(joined).not.toHaveProperty(name)
      const row = templates.find((row) => row.name === name)
      expect(row).toBeDefined()
      if (!row) throw new Error(`Missing template ${name}`)
      expect(partnerModelFor(row, workshopModels)).toBeUndefined()
    }
    const reference = templates.find(
      (row) => row.name === 'api_happyhorse1_1_r2v'
    )
    if (!reference) throw new Error('Missing reference-video fixture')
    expect(useCaseForTemplate(reference, workshopModels)).toBe('animate-images')
  })

  it('preserves non-HappyHorse reference-video operations', () => {
    const templates = hubTemplatesSchema.parse(hubTemplates)
    const row = templates.find((row) => row.name === 'api_seedance2_5_r2v')
    if (!row) throw new Error('Missing Seedance reference fixture')
    expect(partnerModelFor(row, workshopModels)?.slug).toBe(
      'byteplus--seedance-2-5-reference--generate-videos'
    )
    expect(useCaseForTemplate(row, workshopModels)).toBe('generate-videos')
  })

  it('reproduces canonical targets that all exist in the published catalogue', () => {
    const { joined } = buildTemplateModelJoin(hubTemplates)
    expect(joined).toEqual(templateModelJoin)
    const slugs = new Set(workshopModels.map((model) => model.slug))
    expect(Object.values(joined).every((slug) => slugs.has(slug))).toBe(true)
  })
})
