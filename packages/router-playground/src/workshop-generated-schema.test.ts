import { describe, expect, it } from 'vitest'

import {
  generatedExampleSchema,
  generatedFieldSchema,
  workshopExampleValuesSchema
} from './workshop-generated-schema'
import type { GeneratedField } from './workshop-types'
import { MODALITIES } from './workshop-types'

describe('generated field schema', () => {
  it.for<GeneratedField>([
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      multiline: true,
      required: true
    },
    { kind: 'number', name: 'seed', label: 'Seed', step: 1, default: 42 },
    { kind: 'select', name: 'size', label: 'Size', options: ['1K', '2K'] },
    { kind: 'toggle', name: 'hd', label: 'HD', default: false },
    {
      kind: 'file',
      name: 'image',
      label: 'Image',
      accept: 'image',
      required: false
    }
  ])('accepts a $kind field', (field) => {
    expect(generatedFieldSchema.parse(field)).toEqual(field)
  })

  it('rejects a select field without options', () => {
    const field = { kind: 'select', name: 'size', label: 'Size', options: [] }
    expect(generatedFieldSchema.safeParse(field).success).toBe(false)
  })

  it('rejects a text field that omits required', () => {
    const field = {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      multiline: true
    }
    expect(generatedFieldSchema.safeParse(field).success).toBe(false)
  })
})

describe('generated example schema', () => {
  it('accepts an example whose values are scalars or string lists', () => {
    const example = {
      name: 'first',
      title: 'First',
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/result.webp',
      values: { prompt: 'A cat', seed: 1, hd: true, images: ['a.png'] }
    }
    expect(generatedExampleSchema.parse(example)).toEqual(example)
  })

  it('rejects values the form cannot hold', () => {
    expect(
      workshopExampleValuesSchema.safeParse({ prompt: { nested: true } })
        .success
    ).toBe(false)
  })
})

it('lists the modalities a generated model may declare', () => {
  expect(MODALITIES).toContain('image')
})
