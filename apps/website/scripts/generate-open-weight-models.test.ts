// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { models } from '@/config/models'
import hubTemplates from '@/data/hubTemplates.json'
import { hubTemplatesSchema } from '@/lib/hub/types'
import generated from '@/lib/workshop/explorer/open-weight-models.generated.json'
import { openWeightModelsFrom } from './generate-open-weight-models'

const templates = hubTemplatesSchema.parse(hubTemplates)
const list = openWeightModelsFrom(models, templates)

describe('openWeightModelsFrom', () => {
  it('matches the committed list', () => {
    expect(generated).toEqual(list)
  })

  it('leaves out files that are parts of a workflow', () => {
    const slugs = list.map((model) => model.slug)
    for (const part of [
      'sam3-1-multiplex-fp16',
      'sdpose-wholebody-fp16',
      'rt-detr-v4-x-hgnet-fp16',
      'lotus-depth-d-v1-1',
      'ae',
      'clip-l'
    ])
      expect(slugs).not.toContain(part)
    expect(
      list.every((model) =>
        ['diffusion_models', 'checkpoints'].includes(
          models.find((page) => page.slug === model.slug)?.directory ?? ''
        )
      )
    ).toBe(true)
  })

  it.for([
    {
      slug: 'qwen-image-edit-2511-bf16',
      modality: 'image',
      useCase: 'edit-images',
      tasks: ['edit']
    },
    {
      slug: 'wan2-2-i2v-high-noise-14b-fp8-scaled',
      modality: 'video',
      useCase: 'animate-images',
      tasks: []
    },
    {
      slug: 'seedvr2-3b-int8-convrot',
      modality: 'image',
      useCase: 'generate-images',
      tasks: ['upscale']
    },
    {
      slug: 'hunyuan3d-dit-v2-fp16',
      modality: '3d',
      useCase: '3d',
      tasks: []
    }
  ])('describes $slug by the template its page shows', (expected) => {
    expect(list.find((model) => model.slug === expected.slug)).toMatchObject(
      expected
    )
  })
})
