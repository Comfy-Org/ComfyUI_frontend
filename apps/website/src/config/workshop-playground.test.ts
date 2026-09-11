import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_BYTES,
  defaultValues,
  exampleValues,
  examplesForModel,
  groupPlaygroundFields,
  schemaForModel,
  isVideoUrl,
  restoreFormValues,
  validateForm
} from './workshop-playground'
import type { GeneratedField } from './models-catalogue'

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

describe('restoreFormValues', () => {
  it('restores only field-typed scalars and preserves deliberate clearing without fake uploads', () => {
    const schema = schemaForModel({ fields: generatedFields })
    expect(
      restoreFormValues(schema, {
        prompt: '',
        mode: 'pro',
        audio: false,
        image: { name: 'not-a-real-upload.png', size: 1, type: 'image/png' },
        unknown: 'discard'
      })
    ).toEqual({ prompt: undefined, mode: 'pro', audio: false })
    expect(
      restoreFormValues(schema, {
        prompt: { invalid: true },
        mode: 'wrong',
        audio: 'false'
      })
    ).toEqual({})
    expect(restoreFormValues(schema, null)).toEqual({})
    expect(restoreFormValues(schema, { audio: null })).toEqual({
      audio: undefined
    })
  })
})

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

describe('groupPlaygroundFields', () => {
  it('keeps ordinary toggles after the primary inputs when Advanced is explicit', () => {
    const groups = groupPlaygroundFields(
      schemaForModel({
        fields: [
          generatedFields[0],
          { ...generatedFields[2], advanced: false },
          { ...generatedFields[1], advanced: true }
        ],
        modality: 'video'
      })
    )
    expect(groups.settings.map((field) => field.name)).toEqual(['audio'])
    expect(groups.advanced.map((field) => field.name)).toEqual(['mode'])
  })

  it('uses explicit Advanced metadata instead of field position', () => {
    const schema = schemaForModel({
      fields: [
        generatedFields[0],
        { ...generatedFields[1], advanced: true },
        { ...generatedFields[2], advanced: false },
        generatedFields[3]
      ],
      modality: 'video'
    })

    const groups = groupPlaygroundFields(schema)
    expect(groups.primary.map((field) => field.name)).toEqual([
      'prompt',
      'image'
    ])
    expect(groups.settings.map((field) => field.name)).toEqual(['audio'])
    expect(groups.advanced.map((field) => field.name)).toEqual(['mode'])
  })

  it('keeps the positional fallback for legacy fields', () => {
    const settings: GeneratedField[] = Array.from(
      { length: 4 },
      (_, index) => ({
        kind: 'number',
        name: `setting_${index}`,
        label: `Setting ${index}`,
        min: 0,
        max: 10,
        step: 1,
        default: 0
      })
    )
    const groups = groupPlaygroundFields(
      schemaForModel({
        fields: [generatedFields[0], ...settings],
        modality: 'image'
      })
    )

    expect(groups.settings).toHaveLength(3)
    expect(groups.advanced.map((field) => field.name)).toEqual(['setting_3'])
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
  it('validates complete property contracts and counts Unicode code points', () => {
    const schema = schemaForModel({
      fields: [
        {
          kind: 'text',
          name: 'label',
          label: 'Label',
          required: false,
          multiline: false,
          maxLength: 2,
          inputSchema: { type: 'string', maxLength: 2 }
        },
        {
          kind: 'number',
          name: 'strength',
          label: 'Strength',
          step: 'any',
          inputSchema: { type: 'number', exclusiveMinimum: 0, maximum: 1 }
        },
        {
          kind: 'text',
          name: 'color',
          label: 'Color',
          required: false,
          multiline: false,
          inputSchema: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
        }
      ]
    })
    expect(
      validateForm(schema, { label: '🌻🌸', strength: 0.001, color: '#aabbcc' })
    ).toEqual({})
    expect(
      validateForm(schema, { label: '🌻🌸🌼', strength: 0, color: 'red' })
    ).toEqual({ label: 'rejected', strength: 'rejected', color: 'rejected' })
    expect(restoreFormValues(schema, { color: 'red', strength: 0 })).toEqual({})
  })

  it('keeps optional parameters absent and preserves numeric select values', () => {
    const fields: GeneratedField[] = [
      { kind: 'number', name: 'seed', label: 'Seed', step: 1 },
      { kind: 'toggle', name: 'audio', label: 'Audio' },
      {
        kind: 'select',
        name: 'fps',
        label: 'FPS',
        required: true,
        options: [25, 50]
      }
    ]
    const schema = schemaForModel({ fields, modality: 'video' })
    expect(defaultValues(schema)).toEqual({
      seed: undefined,
      audio: undefined,
      fps: undefined
    })
    expect(validateForm(schema, { fps: 50, seed: 123456789 })).toEqual({})
    expect(validateForm(schema, { fps: '50' })).toEqual({ fps: 'badOption' })
    expect(validateForm(schema, {})).toEqual({ fps: 'required' })
  })

  it('enforces JSON and text constraints without narrowing unbounded numbers', () => {
    const schema = schemaForModel({
      fields: [
        {
          kind: 'text',
          name: 'items',
          label: 'Items',
          multiline: true,
          required: false,
          valueType: 'json',
          jsonSchema: { type: 'array', items: { type: 'string' }, maxItems: 2 }
        },
        {
          kind: 'text',
          name: 'prompt',
          label: 'Prompt',
          multiline: true,
          required: true,
          minLength: 2,
          maxLength: 5
        },
        { kind: 'number', name: 'scale', label: 'Scale', step: 'any' }
      ],
      modality: 'image'
    })
    expect(
      validateForm(schema, { items: '["a"]', prompt: 'hello', scale: -12.3456 })
    ).toEqual({})
    expect(
      validateForm(schema, { items: '[1]', prompt: 'x', scale: Infinity })
    ).toEqual({ items: 'rejected', prompt: 'rejected', scale: 'outOfRange' })
  })

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
    expect(validateForm(schema, { ...valid, image: true })).toEqual({
      image: 'badType'
    })
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

  it('carries the declared media kind without guessing from the URL', () => {
    const [audio] = examplesForModel({
      examples: [
        {
          name: 'speech',
          title: 'Speech',
          description: '',
          tags: [],
          thumbnailUrl: 'https://cdn.example/asset-without-extension',
          mediaKind: 'audio',
          values: {}
        }
      ]
    })
    expect(audio.mediaKind).toBe('audio')
  })

  it('reads back only the settings that say something', () => {
    const shared = {
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/x.webp'
    }
    const [sized, verbose, bare] = examplesForModel({
      examples: [
        {
          ...shared,
          name: 'a',
          title: 'Sized',
          values: { prompt: '  a capybara  ', resolution: '480p', duration: 5 }
        },
        {
          ...shared,
          name: 'b',
          title: 'Verbose',
          values: { prompt: '', size: '720p: 16:9 (1280x720)' }
        },
        { ...shared, name: 'c', title: 'Bare', values: { size: 'auto' } }
      ]
    })
    expect(sized.specs).toEqual(['480p', '5s'])
    expect(verbose.specs).toEqual(['720p'])
    expect(bare.specs).toEqual([])
  })
})

describe('exampleValues', () => {
  it('prefills settings without pretending the example output is an input upload', () => {
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
      specs: [],
      values: { prompt: 'a capybara', size: '2K' },
      outputUrl: 'https://example.com/out.webp'
    })
    expect(values.prompt).toBe('a capybara')
    expect(values.size).toBe('2K')
    expect(values.image).toBeUndefined()
    expect(validateForm(schema, values)).toEqual({ image: 'required' })
  })
})

describe('isVideoUrl', () => {
  it('recognises a video regardless of what trails the extension', () => {
    expect(isVideoUrl('https://cdn.example/output.mp4')).toBe(true)
    expect(isVideoUrl('https://cdn.example/output.mp4?sig=abc')).toBe(true)
    expect(isVideoUrl('https://cdn.example/output.mp4#t=0')).toBe(true)
    expect(isVideoUrl('https://cdn.example/output.png')).toBe(false)
  })
})

describe('example titles', () => {
  const shared = {
    description: '',
    tags: [],
    thumbnailUrl: 'https://example.com/x.webp',
    values: {}
  }

  it('drops the part that only names the model again', () => {
    const [a, b] = examplesForModel({
      examples: [
        { ...shared, name: 'a', title: 'Grok: Video generation' },
        { ...shared, name: 'b', title: 'Grok Imagine 1.5: Image to Video' }
      ]
    })
    expect([a.title, b.title]).toEqual(['Video generation', 'Image to Video'])
  })

  it('keeps it when it is the only thing telling two apart', () => {
    const [a, b] = examplesForModel({
      examples: [
        { ...shared, name: 'a', title: 'Seedance 1.5 Pro: Image to Video' },
        { ...shared, name: 'b', title: 'Seedance 1.0 Pro: Image to Video' }
      ]
    })
    expect([a.title, b.title]).toEqual([
      'Seedance 1.5 Pro: Image to Video',
      'Seedance 1.0 Pro: Image to Video'
    ])
  })
})
