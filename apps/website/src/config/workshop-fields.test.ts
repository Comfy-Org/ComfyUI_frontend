import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { workshopModelSchema } from '../content/workshop-models.schema'
import { deriveWorkshopFields } from './workshop-fields'

const COLLECTION = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'workshop-models'
)

const collection = readdirSync(COLLECTION)
  .filter((file) => file.endsWith('.json'))
  .map((file) =>
    workshopModelSchema.parse(
      JSON.parse(readFileSync(join(COLLECTION, file), 'utf8'))
    )
  )

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
    for (const model of collection) {
      const fields = deriveWorkshopFields(model.parameters, model.roles)
      const fieldNames = new Set(fields.map((field) => field.name))
      const required = Array.isArray(model.parameters.required)
        ? model.parameters.required
        : []
      for (const name of required) {
        if (['model', 'medias', 'dispatch_mode'].includes(name)) continue
        expect(fieldNames, `${model.id} is missing ${name}`).toContain(name)
      }
      expect(
        deriveWorkshopFields(model.parameters, model.roles),
        `${model.id} has no form fields`
      ).not.toHaveLength(0)
      expect(
        new Set(
          deriveWorkshopFields(model.parameters, model.roles).map(
            (field) => field.name
          )
        ).size,
        `${model.id} has duplicate form field names`
      ).toBe(deriveWorkshopFields(model.parameters, model.roles).length)
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

describe('open-ended and free-precision inputs', () => {
  it('keeps a curated-or-custom field open instead of closing it', () => {
    // ElevenLabs and Fish Audio `voice`, and HeyGen `avatar_id`, list stock
    // options but also accept an id you cloned yourself. A closed select
    // makes your own voice unreachable.
    const [field] = deriveWorkshopFields(
      {
        properties: {
          voice: {
            anyOf: [{ enum: ['rachel', 'adam'] }, { type: 'string' }],
            description: 'A stock voice, or your own voice id.'
          }
        }
      },
      []
    )

    expect(field?.kind).toBe('text')
    expect(field?.kind === 'text' && field.suggestions).toEqual([
      'rachel',
      'adam'
    ])
  })

  it('still closes a field that only offers listed values', () => {
    const [field] = deriveWorkshopFields(
      { properties: { size: { enum: ['1024x1024', '512x512'] } } },
      []
    )

    expect(field?.kind).toBe('select')
  })

  it('does not invent a precision limit the schema never set', () => {
    const [free] = deriveWorkshopFields(
      { properties: { guidance: { type: 'number', minimum: 0, maximum: 10 } } },
      []
    )
    const [declared] = deriveWorkshopFields(
      { properties: { strength: { type: 'number', multipleOf: 0.05 } } },
      []
    )
    const [whole] = deriveWorkshopFields(
      { properties: { seed: { type: 'integer' } } },
      []
    )

    expect(free?.kind === 'number' && free.step).toBe('any')
    expect(declared?.kind === 'number' && declared.step).toBe(0.05)
    expect(whole?.kind === 'number' && whole.step).toBe(1)
  })

  it('leaves no catalog field with an invented 0.01 step', () => {
    const invented = collection.flatMap((model) =>
      deriveWorkshopFields(model.parameters, model.roles).filter((field) => {
        if (field.kind !== 'number' || field.step !== 0.01) return false
        const schema = (model.parameters.properties as Record<string, unknown>)[
          field.name
        ]
        return (
          !schema ||
          typeof schema !== 'object' ||
          (schema as Record<string, unknown>).multipleOf !== 0.01
        )
      })
    )

    expect(invented).toEqual([])
  })
})
