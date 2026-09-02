import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_BYTES,
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import { buildSnippet } from './workshop-snippets'
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
})

describe('buildSnippet', () => {
  const values = {
    prompt: 'a cat',
    seed: 7,
    audio: true,
    image: { name: 'ref.png', size: 1, type: 'image/png' },
    unused: undefined
  }

  it('inlines form values and references uploads by file name', () => {
    const python = buildSnippet('python', 'kling/kling-ai', values)
    expect(python).toContain('"kling/kling-ai"')
    expect(python).toContain('"prompt": "a cat"')
    expect(python).toContain('"audio": true')
    expect(python).toContain('"image": "<ref.png>"')
    expect(python).not.toContain('unused')
  })

  it('renders the same input for every language', () => {
    for (const language of ['typescript', 'http'] as const) {
      expect(buildSnippet(language, 'kling/kling-ai', values)).toContain(
        '"seed": 7'
      )
    }
  })
})
