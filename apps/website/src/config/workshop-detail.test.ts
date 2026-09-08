import { describe, expect, it } from 'vitest'

import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { WorkshopDetailModel } from './workshop-detail'
import {
  defaultWorkshopValues,
  relatedWorkshopModels,
  toDetailModel
} from './workshop-detail'

const entry: WorkshopModelEntry = {
  id: 'provider/model-v1',
  slug: 'provider--model-v1',
  displayName: 'Model V1',
  provider: 'provider',
  modality: 'image',
  description: 'Generates an image.',
  tags: ['text-to-image'],
  parameters: {
    type: 'object',
    required: ['prompt'],
    properties: { prompt: { type: 'string' } }
  },
  roles: []
}

function model(
  slug: string,
  provider: string,
  modality: string
): WorkshopDetailModel {
  return { ...toDetailModel(entry), slug, provider, modality }
}

describe('toDetailModel', () => {
  it('derives fields rather than reading a stored copy', () => {
    // The catalog carries the provider's schema; the form shape is decided
    // here, so a policy change does not require regenerating 268 files.
    expect(toDetailModel(entry).fields).toEqual([
      {
        kind: 'text',
        name: 'prompt',
        label: 'Prompt',
        required: true,
        multiline: true,
        valueType: 'string'
      }
    ])
  })

  it('carries the identity the run call needs', () => {
    expect(toDetailModel(entry)).toMatchObject({
      id: 'provider/model-v1',
      slug: 'provider--model-v1',
      displayName: 'Model V1'
    })
  })
})

describe('defaultWorkshopValues', () => {
  it('seeds a value for every field, defined or not', () => {
    expect(
      defaultWorkshopValues([
        {
          kind: 'toggle',
          name: 'enhance',
          label: 'Enhance',
          required: false,
          defaultValue: true
        },
        {
          kind: 'text',
          name: 'prompt',
          label: 'Prompt',
          required: true,
          multiline: true,
          valueType: 'string'
        }
      ])
      // `prompt` is present and undefined rather than absent, so the form binds
      // every input on first render instead of switching from uncontrolled.
    ).toEqual({ enhance: true, prompt: undefined })
  })
})

describe('relatedWorkshopModels', () => {
  const subject = model('subject', 'alpha', 'image')
  const pool = [
    subject,
    model('same-both', 'alpha', 'image'),
    model('same-provider', 'alpha', 'video'),
    model('same-modality', 'beta', 'image'),
    model('unrelated', 'beta', 'audio')
  ]

  it('ranks same provider above same modality, and excludes itself', () => {
    expect(
      relatedWorkshopModels(subject, pool).map((entry) => entry.slug)
    ).toEqual(['same-both', 'same-provider', 'same-modality', 'unrelated'])
  })

  it('never returns more than the limit', () => {
    expect(relatedWorkshopModels(subject, pool, 2)).toHaveLength(2)
  })
})
