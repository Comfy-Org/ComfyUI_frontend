import { describe, expect, it } from 'vitest'

import { decodeGeneratedModels } from './models-catalogue'

const field = {
  kind: 'text',
  name: 'prompt',
  label: 'Prompt',
  multiline: true,
  required: true
}
const example = {
  name: 'example',
  title: 'Example',
  description: '',
  tags: [],
  thumbnailUrl: 'https://example.com/image.png',
  values: {}
}
const good = { fields: [field], examples: [example], defaults: {} }

describe('complete generated-model boundary', () => {
  it.for<unknown>([
    { ...good, modality: 'html' },
    { ...good, thumbnailUrl: 123 },
    { ...good, provider: [] },
    { ...good, priceUsdFrom: Infinity },
    { ...good, node: { id: 'node', displayName: 'Node' } },
    { ...good, fields: [{ ...field, inputSchema: 'invalid' }] },
    { ...good, fields: [{ ...field, jsonSchema: 'invalid' }] },
    { ...good, fields: [{ ...field, valueType: 'html' }] },
    { ...good, fields: [{ ...field, suggestions: [null] }] },
    { ...good, fields: [{ ...field, minLength: 'one' }] },
    { ...good, fields: [{ ...field, presentation: { label: 'Not enough' } }] },
    {
      ...good,
      fields: [
        {
          kind: 'number',
          name: 'steps',
          label: 'Steps',
          step: 1,
          required: 'yes'
        }
      ]
    },
    {
      ...good,
      fields: [
        { kind: 'toggle', name: 'enabled', label: 'Enabled', required: 'yes' }
      ]
    },
    {
      ...good,
      fields: [
        {
          kind: 'select',
          name: 'option',
          label: 'Option',
          options: ['a'],
          required: 'yes'
        }
      ]
    },
    {
      ...good,
      fields: [
        {
          kind: 'file',
          name: 'image',
          label: 'Image',
          required: true,
          accept: 'image',
          multiple: 'yes'
        }
      ]
    },
    {
      ...good,
      fields: [
        {
          kind: 'file',
          name: 'image',
          label: 'Image',
          required: true,
          accept: 'image',
          mimeTypes: [3]
        }
      ]
    },
    { ...good, examples: [{ ...example, mediaKind: 'html' }] },
    {
      ...good,
      examples: [{ ...example, fields: [{ ...field, required: 'yes' }] }]
    }
  ])(
    'drops malformed optional properties without trusting a type assertion: %j',
    (bad) => {
      expect(decodeGeneratedModels({ good, bad })).toEqual({ good })
    }
  )

  it.for<unknown>([null, [], [good], 'invalid'])(
    'rejects non-record manifests: %j',
    (value) => {
      expect(decodeGeneratedModels(value)).toEqual({})
    }
  )
})
