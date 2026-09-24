// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../src/config/models-catalogue'
import {
  authoredWorkshopModels,
  workshopModels
} from '../src/config/workshop-browse-content'
import { isWorkshopModelDisabled } from '../src/config/workshop-model-availability'
import hubTemplates from '../src/data/hubTemplates.json'
import templateModelJoin from '../src/data/templateModelJoin.json'
import {
  partnerModelFor,
  useCaseForTemplate
} from '../src/lib/hub/template-use-case'
import { hubTemplatesSchema } from '../src/lib/hub/types'
import type { HubTemplate } from '../src/lib/hub/types'
import { buildTemplateModelJoin } from './generate-template-model-join'

// These join the whole published corpus rather than a fixture, which takes
// seconds rather than milliseconds, so they say so instead of sitting just
// under the default budget and crossing it on a loaded runner.
const CORPUS_TIMEOUT = 30_000

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

const templates = hubTemplatesSchema.parse(hubTemplates)

function templateNamed(name: string): HubTemplate {
  const row = templates.find((template) => template.name === name)
  if (!row) throw new Error(`Missing template ${name}`)
  return row
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

  it(
    'keeps supported HappyHorse operations and versions distinct',
    () => {
      const { joined } = buildTemplateModelJoin(templates)
      const expected = {
        api_happyhorse1_1_i2v: 'wan--happyhorse-image-to-video--animate-images',
        api_happyhorse1_1_r2v:
          'wan--happyhorse-reference-video--animate-images',
        api_happyhorse1_1_t2v: 'wan--happyhorse-text-to-video--generate-videos',
        api_happyhorse1_0_video_edit: 'wan--happyhorse-video-edit--edit-videos'
      }
      for (const [name, slug] of Object.entries(expected)) {
        expect(joined[name]).toBe(slug)
        expect(
          partnerModelFor(templateNamed(name), authoredWorkshopModels)?.slug
        ).toBe(slug)
      }
    },
    CORPUS_TIMEOUT
  )

  it(
    'does not guess unsupported operations or cross media types',
    () => {
      const { joined } = buildTemplateModelJoin(templates)
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
        expect(
          partnerModelFor(templateNamed(name), workshopModels)
        ).toBeUndefined()
      }
    },
    CORPUS_TIMEOUT
  )

  it('applies publication state without changing the canonical join', () => {
    const reference = templateNamed('api_happyhorse1_1_r2v')
    expect(useCaseForTemplate(reference, workshopModels)).toBe('animate-images')
    const imageToVideo = templateNamed('api_happyhorse1_1_i2v')
    const slug = 'wan--happyhorse-image-to-video--animate-images'
    expect(partnerModelFor(imageToVideo, workshopModels)?.slug).toBe(
      isWorkshopModelDisabled(slug) ? undefined : slug
    )
  })

  it('preserves non-HappyHorse reference-video operations', () => {
    const templates = hubTemplatesSchema.parse(hubTemplates)
    const row = templates.find((row) => row.name === 'api_seedance2_5_r2v')
    if (!row) throw new Error('Missing Seedance reference fixture')
    expect(partnerModelFor(row, workshopModels)?.slug).toBe(
      'byteplus--seedance-2-5-reference--generate-videos'
    )
    expect(useCaseForTemplate(row, workshopModels)).toBe('animate-images')
  })

  it(
    'reproduces canonical authored targets independently of publication',
    () => {
      const { joined } = buildTemplateModelJoin(hubTemplates)
      expect(joined).toEqual(templateModelJoin)
      const slugs = new Set(authoredWorkshopModels.map((model) => model.slug))
      expect(Object.values(joined).every((slug) => slugs.has(slug))).toBe(true)
    },
    CORPUS_TIMEOUT
  )
})
