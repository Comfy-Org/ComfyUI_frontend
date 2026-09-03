import { describe, expect, it } from 'vitest'

import snapshot from '../src/config/workshop-catalog.generated.json'
import {
  buildWorkshopCatalog,
  deriveWorkshopFields
} from './generate-workshop-catalog'

const validModel = {
  id: 'provider/model-v1',
  display_name: 'Model V1',
  provider: 'provider',
  type: 'image',
  description: 'Generates an image.',
  tags: ['text-to-image'],
  parameters: {
    type: 'object',
    properties: { prompt: { type: 'string' } }
  },
  roles: [
    {
      role: 'image',
      required: false,
      cardinality: 'many',
      minItems: 0,
      maxItems: 4
    }
  ]
}

describe('buildWorkshopCatalog', () => {
  it('keeps the Router id and schema and creates a URL-safe slug', () => {
    expect(buildWorkshopCatalog([validModel])).toEqual([
      {
        id: 'provider/model-v1',
        slug: 'provider--model-v1',
        displayName: 'Model V1',
        provider: 'provider',
        modality: 'image',
        description: 'Generates an image.',
        tags: ['text-to-image'],
        parameters: validModel.parameters,
        roles: validModel.roles,
        fields: [
          {
            kind: 'text',
            name: 'prompt',
            label: 'Prompt',
            required: false,
            multiline: true,
            valueType: 'string'
          },
          {
            kind: 'media',
            name: 'media_image',
            role: 'image',
            label: 'Image',
            required: false,
            multiple: true,
            accept: 'image'
          }
        ]
      }
    ])
  })

  it('rejects malformed records instead of silently omitting a route', () => {
    expect(() =>
      buildWorkshopCatalog([validModel, { ...validModel, id: undefined }])
    ).toThrow('Invalid partner models at indexes: 1')
  })

  it('rejects duplicate ids', () => {
    expect(() => buildWorkshopCatalog([validModel, validModel])).toThrow(
      'Duplicate partner model id'
    )
  })
})

describe('deriveWorkshopFields', () => {
  it('maps Router properties and media roles to form controls', () => {
    expect(
      deriveWorkshopFields(
        {
          type: 'object',
          properties: {
            model: { type: 'string' },
            dispatch_mode: { type: 'string', enum: ['sync', 'async'] },
            prompt: { type: 'string', maxLength: 2000 },
            count: {
              type: 'integer',
              minimum: 1,
              maximum: 4,
              default: 2
            },
            quality: {
              type: 'string',
              enum: ['standard', 'high'],
              default: 'high'
            },
            enhance: { type: 'boolean', default: true }
          },
          required: ['prompt']
        },
        [
          {
            role: 'reference_image',
            required: true,
            cardinality: 'single',
            minItems: 1,
            maxItems: 1
          }
        ]
      )
    ).toEqual([
      {
        kind: 'text',
        name: 'prompt',
        label: 'Prompt',
        required: true,
        multiline: true,
        valueType: 'string'
      },
      {
        kind: 'number',
        name: 'count',
        label: 'Count',
        required: false,
        integer: true,
        min: 1,
        max: 4,
        step: 1,
        defaultValue: 2
      },
      {
        kind: 'select',
        name: 'quality',
        label: 'Quality',
        required: false,
        options: ['standard', 'high'],
        defaultValue: 'high'
      },
      {
        kind: 'toggle',
        name: 'enhance',
        label: 'Enhance',
        required: false,
        defaultValue: true
      },
      {
        kind: 'media',
        name: 'media_reference_image',
        role: 'reference_image',
        label: 'Reference Image',
        required: true,
        multiple: false,
        accept: 'image'
      }
    ])
  })

  it('represents every required input in the committed catalog', () => {
    for (const model of snapshot.models) {
      const fieldNames = new Set(model.fields.map((field) => field.name))
      const required = Array.isArray(model.parameters.required)
        ? model.parameters.required
        : []
      for (const name of required) {
        if (['model', 'medias', 'dispatch_mode'].includes(name)) continue
        expect(fieldNames, `${model.id} is missing ${name}`).toContain(name)
      }
      expect(model.fields, `${model.id} has no form fields`).not.toHaveLength(0)
      expect(
        new Set(model.fields.map((field) => field.name)).size,
        `${model.id} has duplicate form field names`
      ).toBe(model.fields.length)
    }
  })

  it('keeps complex required inputs usable as JSON text', () => {
    expect(
      deriveWorkshopFields(
        {
          properties: {
            inputs: { type: 'array', default: [{ text: 'Hello' }] }
          },
          required: ['inputs']
        },
        []
      )
    ).toEqual([
      {
        kind: 'text',
        name: 'inputs',
        label: 'Inputs',
        required: true,
        multiline: true,
        valueType: 'json',
        defaultValue: '[\n  {\n    "text": "Hello"\n  }\n]'
      }
    ])
  })
})
