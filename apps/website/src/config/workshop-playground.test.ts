import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_BYTES,
  defaultValues,
  exampleValues,
  examplesForModel,
  schemaForModel,
  validateForm
} from './workshop-playground'
import type { GeneratedField } from './workshop'

const generatedFields: GeneratedField[] = [
  {
    kind: 'text',
    name: 'prompt',
    label: 'Prompt',
    multiline: true,
    required: true
  },
  {
    kind: 'select',
    name: 'mode',
    label: 'Mode',
    options: ['std', 'pro'],
    default: 'pro'
  },
  { kind: 'toggle', name: 'audio', label: 'Audio', default: true },
  {
    kind: 'file',
    name: 'image',
    label: 'Image',
    accept: 'image',
    required: false
  }
]

describe('schemaForModel', () => {
  it('uses the generated node inputs when present', () => {
    const schema = schemaForModel({
      fields: generatedFields,
      modality: 'video'
    })
    expect(schema.map((f) => f.kind)).toEqual([
      'text',
      'select',
      'toggle',
      'file'
    ])
  })

  it('falls back to a modality schema otherwise', () => {
    const schema = schemaForModel({ fields: [], modality: 'video' })
    expect(schema.map((f) => f.name)).toContain('duration')
  })
})

describe('defaultValues', () => {
  const schema = schemaForModel({ fields: generatedFields, modality: 'video' })

  it('seeds selects, numbers and toggles, leaves text and files empty', () => {
    const values = defaultValues(schema)
    expect(values).toEqual({
      prompt: undefined,
      mode: 'pro',
      audio: true,
      image: undefined
    })
  })

  it('prefers the template values it is given', () => {
    expect(
      defaultValues(schema, { prompt: 'a cat', mode: 'std' })
    ).toMatchObject({ prompt: 'a cat', mode: 'std', audio: true })
  })
})

describe('validateForm', () => {
  const schema = schemaForModel({ fields: generatedFields, modality: 'video' })

  it('requires a prompt', () => {
    expect(validateForm(schema, defaultValues(schema))).toEqual({
      prompt: 'required'
    })
    expect(
      validateForm(schema, { ...defaultValues(schema), prompt: '  ' })
    ).toEqual({ prompt: 'required' })
  })

  it('rejects uploads over 25 MB or of the wrong type', () => {
    const valid = { ...defaultValues(schema), prompt: 'ok' }
    expect(
      validateForm(schema, {
        ...valid,
        image: {
          name: 'big.png',
          size: MAX_UPLOAD_BYTES + 1,
          type: 'image/png'
        }
      })
    ).toEqual({ image: 'tooLarge' })
    expect(
      validateForm(schema, {
        ...valid,
        image: { name: 'clip.mp4', size: 10, type: 'video/mp4' }
      })
    ).toEqual({ image: 'badType' })
    expect(
      validateForm(schema, {
        ...valid,
        image: { name: 'ok.webp', size: 10, type: 'image/webp' }
      })
    ).toEqual({})
  })

  it('rejects numbers off their range or step and unknown select options', () => {
    const fallback = schemaForModel({ fields: [], modality: 'video' })
    const valid = { ...defaultValues(fallback), prompt: 'ok' }
    expect(validateForm(fallback, valid)).toEqual({})
    expect(validateForm(fallback, { ...valid, duration: 11 })).toEqual({
      duration: 'outOfRange'
    })
    expect(validateForm(fallback, { ...valid, seed: 2.5 })).toEqual({
      seed: 'outOfRange'
    })
    expect(validateForm(fallback, { ...valid, aspect_ratio: '3:2' })).toEqual({
      aspect_ratio: 'badOption'
    })
  })
})

describe('examplesForModel', () => {
  it('carries the form of templates that run a different node', () => {
    const shared = {
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/x.webp',
      values: { prompt: 'hi' }
    }
    const [plain, variant] = examplesForModel({
      examples: [
        { ...shared, name: 'a', title: 'Plain' },
        {
          ...shared,
          name: 'b',
          title: 'Variant',
          node: { id: 'X', displayName: 'First-Last-Frame' },
          fields: generatedFields
        }
      ]
    })
    expect(plain).not.toHaveProperty('fields')
    expect(variant).toMatchObject({
      nodeDisplayName: 'First-Last-Frame',
      fields: generatedFields
    })
  })
})

describe('exampleValues', () => {
  it('fills the form from the example and stands in for its uploads', () => {
    const schema = schemaForModel({
      fields: [
        {
          kind: 'text',
          name: 'prompt',
          label: 'Prompt',
          multiline: true,
          required: true
        },
        {
          kind: 'file',
          name: 'image',
          label: 'Image',
          accept: 'image',
          required: true
        },
        {
          kind: 'select',
          name: 'size',
          label: 'Size',
          options: ['1K', '2K'],
          default: '1K'
        }
      ],
      modality: 'image'
    })
    const values = exampleValues(schema, {
      id: 'demo',
      title: 'Demo',
      description: '',
      values: { prompt: 'a capybara', size: '2K' },
      outputUrl: 'https://example.com/out.webp'
    })
    expect(values.prompt).toBe('a capybara')
    expect(values.size).toBe('2K')
    expect(values.image).toMatchObject({
      name: 'demo-image.webp',
      type: 'image/webp',
      previewUrl: 'https://example.com/out.webp'
    })
    expect(validateForm(schema, values)).toEqual({})
  })
})
