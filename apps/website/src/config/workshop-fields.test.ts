import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import { workshopModelSchema } from '../content/workshop-models.schema'
import { deriveWorkshopFields } from './workshop-fields'
import { parseWorkshopJsonInput } from './workshop-json-schema'

// The committed catalog: one packed array, a model per line. Read it the way
// the content loader does rather than scanning a directory that no longer
// exists, and validate every entry so the test fails on a bad catalog.
const CATALOG = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'workshop-models.json'
)

const collection = z
  .array(workshopModelSchema)
  .parse(JSON.parse(readFileSync(CATALOG, 'utf8')))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('deriveWorkshopFields', () => {
  it('does not invent defaults for optional booleans', () => {
    const fields = deriveWorkshopFields(
      { properties: { enabled: { type: 'boolean' } } },
      []
    )
    expect(fields[0]).toMatchObject({ kind: 'toggle', required: false })
    expect(fields[0]).not.toHaveProperty('defaultValue')
  })

  it('preserves the catalog true-only regeneration constraint without a false default', () => {
    const model = collection.find(
      (model) => model.id === 'minimax/hailuo-03-regeneration'
    )
    expect(model).toBeDefined()
    if (!model) throw new Error('Missing regeneration model')
    const field = deriveWorkshopFields(model.parameters, model.roles).find(
      (field) => field.name === 'source_is_unmodified_h3_768p'
    )
    expect(field).toMatchObject({
      kind: 'select',
      options: [true],
      required: true
    })
    expect(field).not.toHaveProperty('defaultValue')
  })

  it('maps Router properties and media roles to form controls', () => {
    expect(
      deriveWorkshopFields(
        {
          type: 'object',
          properties: {
            model: { type: 'string' },
            medias: { type: 'array' },
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
        valueType: 'string',
        maxLength: 2000
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
        maxItems: 1,
        accept: 'image'
      }
    ])
  })

  it('represents every required input in the committed catalog', () => {
    expect(collection.length).toBeGreaterThan(0)
    for (const model of collection) {
      const fields = deriveWorkshopFields(model.parameters, model.roles)
      const fieldNames = new Set(fields.map((field) => field.name))
      // JSON Schema says `required` is an array of strings, but the schema
      // types it as arbitrary JSON, so narrow rather than assume.
      const required = Array.isArray(model.parameters.required)
        ? model.parameters.required.filter(
            (name): name is string => typeof name === 'string'
          )
        : []
      for (const name of required) {
        if (['model', 'medias', 'dispatch_mode'].includes(name)) continue
        expect(fieldNames, `${model.id} is missing ${name}`).toContain(name)
      }
      expect(fields, `${model.id} has no form fields`).not.toHaveLength(0)
      expect(
        new Set(fields.map((field) => field.name)).size,
        `${model.id} has duplicate form field names`
      ).toBe(fields.length)
    }
  })

  it('maps every media role shape to the correct upload control', () => {
    expect(
      deriveWorkshopFields({ properties: {} }, [
        {
          role: 'source_video',
          required: true,
          cardinality: 'single',
          minItems: 1,
          maxItems: 1
        },
        {
          role: 'reference_audio',
          required: false,
          cardinality: 'many',
          minItems: 0
        },
        {
          role: 'document',
          required: false,
          cardinality: 'single',
          minItems: 0,
          maxItems: 1
        },
        {
          role: 'mask',
          required: false,
          cardinality: 'single',
          minItems: 0,
          maxItems: 1
        }
      ])
    ).toEqual([
      expect.objectContaining({
        kind: 'media',
        role: 'source_video',
        accept: 'video',
        multiple: false
      }),
      expect.objectContaining({
        kind: 'media',
        role: 'reference_audio',
        accept: 'audio',
        multiple: true
      }),
      expect.objectContaining({
        kind: 'media',
        role: 'document',
        accept: 'file',
        multiple: false
      }),
      expect.objectContaining({
        kind: 'media',
        role: 'mask',
        accept: 'image',
        multiple: false
      })
    ])
  })

  it('preserves a bounded multi-file role from the catalog', () => {
    const model = collection.find(
      (model) => model.id === 'bfl/flux-3-image-to-video'
    )
    expect(model).toBeDefined()
    if (!model) throw new Error('Missing FLUX 3 image-to-video model')

    const field = deriveWorkshopFields(model.parameters, model.roles).find(
      (field) => field.kind === 'media' && field.role === 'image'
    )
    expect(field).toMatchObject({
      kind: 'media',
      multiple: true,
      maxItems: 10
    })
  })

  it('preserves text-length constraints from the catalog', () => {
    const model = collection.find(
      (model) => model.id === 'kling/lip-sync-text-to-video'
    )
    expect(model).toBeDefined()
    if (!model) throw new Error('Missing Kling lip-sync model')

    const field = deriveWorkshopFields(model.parameters, model.roles).find(
      (field) => field.name === 'prompt'
    )
    expect(field).toMatchObject({
      kind: 'text',
      minLength: 1,
      maxLength: 120
    })
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
        jsonSchema: {
          type: 'array',
          default: [{ text: 'Hello' }]
        },
        defaultValue: '[\n  {\n    "text": "Hello"\n  }\n]'
      }
    ])
  })

  it('retains and enforces the complete catalog schema for JSON inputs', () => {
    const model = collection.find(
      (model) => model.id === 'elevenlabs/text-to-dialogue'
    )
    expect(model).toBeDefined()
    if (!model) throw new Error('Missing ElevenLabs dialogue model')

    const field = deriveWorkshopFields(model.parameters, model.roles).find(
      (field) => field.name === 'inputs'
    )
    expect(field).toMatchObject({
      kind: 'text',
      valueType: 'json',
      jsonSchema: {
        type: 'array',
        minItems: 1,
        maxItems: 10
      }
    })
    if (field?.kind !== 'text' || !field.jsonSchema) {
      throw new Error('Missing JSON schema for dialogue inputs')
    }

    expect(parseWorkshopJsonInput('[]', field.jsonSchema).success).toBe(false)
    expect(parseWorkshopJsonInput('[{text:', field.jsonSchema).success).toBe(
      false
    )
    expect(
      parseWorkshopJsonInput('[{"text":"Hello"}]', field.jsonSchema).success
    ).toBe(false)
    expect(
      parseWorkshopJsonInput(
        '[{"text":"Hello","voice_id":"Sarah"}]',
        field.jsonSchema
      )
    ).toEqual({
      success: true,
      value: [{ text: 'Hello', voice_id: 'Sarah' }]
    })
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

    expect(field).toMatchObject({
      kind: 'text',
      hint: 'A stock voice, or your own voice id.',
      suggestions: ['rachel', 'adam']
    })
  })

  it('still closes a field that only offers listed values', () => {
    const [field] = deriveWorkshopFields(
      { properties: { size: { enum: ['1024x1024', '512x512'] } } },
      []
    )

    expect(field.kind).toBe('select')
  })

  it('honors an outer enum that narrows an otherwise open string variant', () => {
    const [field] = deriveWorkshopFields(
      {
        properties: {
          duration: {
            type: 'string',
            anyOf: [{ enum: ['5s', '9s'] }, { type: 'string' }],
            enum: ['5s', '9s'],
            default: '5s'
          }
        }
      },
      []
    )
    expect(field).toMatchObject({
      kind: 'select',
      options: ['5s', '9s'],
      defaultValue: '5s'
    })
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

    expect(free.kind === 'number' && free.step).toBe('any')
    expect(declared.kind === 'number' && declared.step).toBe(0.05)
    expect(whole.kind === 'number' && whole.step).toBe(1)
  })

  it('leaves no catalog field with an invented 0.01 step', () => {
    const invented = collection.flatMap((model) =>
      deriveWorkshopFields(model.parameters, model.roles).filter((field) => {
        if (field.kind !== 'number' || field.step !== 0.01) return false
        const properties = model.parameters.properties
        const schema = isRecord(properties) ? properties[field.name] : undefined
        return !isRecord(schema) || schema.multipleOf !== 0.01
      })
    )

    expect(invented).toEqual([])
  })

  it('offers an image picker for angle-named media roles', () => {
    // view_left / view_right / view_back name the camera angle, not the
    // medium. Matched by substring alone they fall through to a generic file
    // picker, and kling/dual-character-effect has only those two roles, so it
    // would offer no image picker at all.
    const fields = deriveWorkshopFields({ type: 'object', properties: {} }, [
      { role: 'view_left', required: true, cardinality: 'single', minItems: 1 },
      { role: 'view_right', required: true, cardinality: 'single', minItems: 1 }
    ])

    expect(
      fields.map((field) => field.kind === 'media' && field.accept)
    ).toEqual(['image', 'image'])
  })

  it('gives unbounded free text a textarea, not a one-line input', () => {
    // Testing only `maxLength > 200` sends every unbounded string to a
    // single-line box. Unbounded is the common case in this catalog: no
    // negative_prompt anywhere declares a maxLength.
    const [unbounded, short, long] = deriveWorkshopFields(
      {
        type: 'object',
        properties: {
          negative_prompt: { type: 'string' },
          title: { type: 'string', maxLength: 60 },
          story: { type: 'string', maxLength: 4000 }
        }
      },
      []
    )

    expect(unbounded.kind === 'text' && unbounded.multiline).toBe(true)
    expect(short.kind === 'text' && short.multiline).toBe(false)
    expect(long.kind === 'text' && long.multiline).toBe(true)
  })
})
