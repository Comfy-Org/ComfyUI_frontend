import { describe, expect, it } from 'vitest'

import snapshots from '../data/workshop-router-openapi.snapshot.json'
import { packRouterSchemas } from '../../scripts/generate-workshop-router-snapshot'
import { fieldsForDefinition } from './workshop-form-definition'
import {
  groupPlaygroundFields,
  schemaForModel,
  validateForm
} from './workshop-playground'
import {
  normalizeOpenApiSchema,
  validateWorkshopInput,
  validatorFor
} from './workshop-json-schema'
import {
  parseRouterOpenApiSnapshot,
  resolveSchemaReference,
  routerFormDefinition,
  routerInputSchema
} from './workshop-router-openapi'

const first = snapshots[0]
const referenced = parseRouterOpenApiSnapshot(
  snapshots.find((entry) => entry.id === 'ideogram/ideogram-v4')
)

describe('Router OpenAPI snapshots', () => {
  it('projects composed object controls without dropping the original restrictions', () => {
    const snapshot = parseRouterOpenApiSnapshot(
      snapshots.find((entry) => entry.id === 'ideogram/ideogram-v3')
    )
    const native =
      snapshot.document.paths['/v2/models/ideogram/ideogram-v3'].post
        .requestBody.content['application/json'].schema
    const schema = routerInputSchema(snapshot)
    expect(schema.allOf).toEqual(native.allOf)
    expect(schema.required).toEqual(['prompt', 'rendering_speed'])
    expect(schema.properties).toHaveProperty('prompt')
    const request = { prompt: 'A red teapot', rendering_speed: 'DEFAULT' }
    expect(validateWorkshopInput(request, schema)).toBe(true)
    expect(validateWorkshopInput({ prompt: request.prompt }, schema)).toBe(
      false
    )
    expect(
      validateWorkshopInput({ ...request, rendering_speed: 'invented' }, schema)
    ).toBe(false)
    expect(
      validateWorkshopInput(
        { ...request, character_reference_images: [] },
        schema
      )
    ).toBe(false)
  })

  it('intersects repeated composed properties rather than overwriting their constraints', () => {
    const snapshot = parseRouterOpenApiSnapshot(structuredClone(first))
    snapshot.document.paths[
      `/v2/models/${snapshot.id}`
    ].post.requestBody.content['application/json'].schema = {
      allOf: [
        {
          type: 'object',
          properties: { count: { type: 'integer', minimum: 1 } },
          required: ['count']
        },
        { type: 'object', properties: { count: { maximum: 3 } } }
      ]
    }
    const schema = routerInputSchema(snapshot)
    expect(schema.properties).toEqual({
      count: { allOf: [{ type: 'integer', minimum: 1 }, { maximum: 3 }] }
    })
    expect(validateWorkshopInput({ count: 2 }, schema)).toBe(true)
    for (const body of [{}, { count: 0 }, { count: 4 }, { count: 1.5 }])
      expect(validateWorkshopInput(body, schema)).toBe(false)
  })

  it.for(snapshots)(
    'preserves and compiles the complete input contract: $id',
    (raw) => {
      const snapshot = parseRouterOpenApiSnapshot(raw)
      expect(snapshot).toEqual(raw)
      expect(() => validatorFor(routerInputSchema(snapshot))).not.toThrow()
      const form = routerFormDefinition(snapshot)
      if (!snapshot.document['x-comfy-input-schema-authored']) {
        expect(form).toBeUndefined()
        return
      }
      if (!form) throw new Error('Missing authored form')
      const fields = fieldsForDefinition(form)
      expect(fields.length).toBeGreaterThan(0)
      const schema = schemaForModel({ fields: [], form })
      const groups = groupPlaygroundFields(schema)
      expect(
        [...groups.primary, ...groups.settings, ...groups.advanced]
          .map((field) => field.name)
          .sort()
      ).toEqual(schema.map((field) => field.name).sort())
      for (const field of schema) {
        const inputSchema = field.inputSchema
        if (inputSchema) expect(() => validatorFor(inputSchema)).not.toThrow()
      }
    }
  )

  it('packs deterministically without losing referenced components or output media types', () => {
    const input = snapshots.map(({ id, document }) => ({ id, document }))
    const packed = packRouterSchemas(input, first.sourceCommit)
    expect(packed).toBe(
      packRouterSchemas([...input].reverse(), first.sourceCommit)
    )
    expect(JSON.parse(packed)).toEqual(snapshots)
    expect(packed.trimEnd().split('\n')).toHaveLength(snapshots.length + 2)
    expect(() => packRouterSchemas([], first.sourceCommit)).toThrow('empty')
    expect(() =>
      packRouterSchemas([input[0], input[0]], first.sourceCommit)
    ).toThrow('Duplicate')
  })

  it('rejects mismatched identities and missing or external references before import', () => {
    expect(() =>
      parseRouterOpenApiSnapshot({ ...first, id: 'wrong/model' })
    ).toThrow('identity mismatch')
    const input =
      referenced.document.paths['/v2/models/ideogram/ideogram-v4'].post
        .requestBody.content['application/json'].schema
    for (const $ref of [
      '#/components/schemas/DoesNotExist',
      'https://external.example/schema.json'
    ]) {
      const document = {
        ...referenced.document,
        paths: {
          '/v2/models/ideogram/ideogram-v4': {
            post: {
              ...referenced.document.paths['/v2/models/ideogram/ideogram-v4']
                .post,
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      ...input,
                      properties: { rendering_speed: { $ref } }
                    }
                  }
                }
              }
            }
          }
        }
      }
      expect(() =>
        parseRouterOpenApiSnapshot({ ...referenced, document })
      ).toThrow(/reference/)
    }
  })

  it('renders and validates a referenced enum without accepting an arbitrary string', () => {
    const form = routerFormDefinition(parseRouterOpenApiSnapshot(referenced))
    if (!form) throw new Error('Missing form')
    const schema = schemaForModel({ fields: [], form })
    const field = schema.find((entry) => entry.name === 'rendering_speed')
    if (!field || field.kind !== 'select')
      throw new Error('Missing enum selector')
    expect(
      validateForm([field], { rendering_speed: field.options[0] })
    ).toEqual({})
    expect(
      validateForm([field], { rendering_speed: 'not-a-speed' })
    ).not.toEqual({})
  })

  it('validates a composed request without flattening away its mutually exclusive branches', () => {
    const raw = snapshots.find((entry) => entry.id === 'meshy/meshy-5')
    const form = routerFormDefinition(parseRouterOpenApiSnapshot(raw))
    if (!form) throw new Error('Missing composed form')
    const schema = schemaForModel({ fields: [], form })
    expect(
      validateForm(schema, {
        request_body: JSON.stringify({ mode: 'preview', prompt: 'A red cube' })
      })
    ).toEqual({})
    expect(
      validateForm(schema, {
        request_body: JSON.stringify({ mode: 'refine', prompt: 'A red cube' })
      })
    ).not.toEqual({})
  })

  it('renders single-variant scalar wrappers while preserving their validation and defaults', () => {
    const parameters = {
      type: 'object',
      properties: {
        strength: {
          anyOf: [{ type: 'number', minimum: 0, maximum: 1 }],
          default: 0.25
        },
        enhance: { anyOf: [{ type: 'boolean' }], default: false },
        output_format: {
          anyOf: [{ $ref: '#/components/schemas/Format' }],
          default: 'png'
        }
      },
      components: {
        schemas: { Format: { type: 'string', enum: ['png', 'jpeg'] } }
      }
    }
    const fields = fieldsForDefinition({
      source: 'router',
      parameters,
      roles: [],
      advancedFields: []
    })
    expect(fields).toMatchObject([
      { name: 'strength', kind: 'number', min: 0, max: 1, default: 0.25 },
      { name: 'enhance', kind: 'toggle', default: false },
      {
        name: 'output_format',
        kind: 'select',
        options: ['png', 'jpeg'],
        default: 'png'
      }
    ])
    const schema = schemaForModel({ fields })
    expect(
      validateForm(schema, {
        strength: 0.333,
        enhance: false,
        output_format: 'jpeg'
      })
    ).toEqual({})
    expect(
      validateForm(schema, {
        strength: 1.1,
        enhance: 'false',
        output_format: 'gif'
      })
    ).toEqual({
      strength: 'outOfRange',
      enhance: 'badType',
      output_format: 'badOption'
    })
  })

  it('does not unwrap alternatives with sibling validation constraints', () => {
    const source = { anyOf: [{ type: 'integer', maximum: 20 }], maximum: 10 }
    const resolved = resolveSchemaReference(source, source)
    expect(resolved).toEqual(source)
    expect(validateWorkshopInput(10, resolved)).toBe(true)
    expect(validateWorkshopInput(11, resolved)).toBe(false)
  })

  it('rejects circular references through a single-variant wrapper', () => {
    const root = {
      components: {
        schemas: { Loop: { anyOf: [{ $ref: '#/components/schemas/Loop' }] } }
      }
    }
    expect(() =>
      resolveSchemaReference({ $ref: '#/components/schemas/Loop' }, root)
    ).toThrow('Circular')
  })
})

describe('OpenAPI validation semantics', () => {
  it('accepts nullable referenced values without weakening the non-null contract', () => {
    const schema = {
      type: 'object',
      properties: {
        result: {
          nullable: true,
          allOf: [{ $ref: '#/components/schemas/Result' }]
        }
      },
      components: {
        schemas: { Result: { type: 'string', enum: ['done', 'failed'] } }
      }
    }
    expect(validateWorkshopInput({ result: null }, schema)).toBe(true)
    expect(validateWorkshopInput({ result: 'done' }, schema)).toBe(true)
    expect(validateWorkshopInput({ result: 'invented' }, schema)).toBe(false)
    expect(validateWorkshopInput({ result: 1 }, schema)).toBe(false)
  })
  it.for([
    { value: 0, valid: true },
    { value: 4_294_967_295, valid: true },
    { value: -1, valid: false },
    { value: 4_294_967_296, valid: false },
    { value: 1.5, valid: false },
    { value: '42', valid: false }
  ])('enforces the uint32 seed contract for $value', ({ value, valid }) => {
    expect(
      validateWorkshopInput(value, { type: 'integer', format: 'uint32' })
    ).toBe(valid)
  })

  it('preserves exclusive numeric bounds and rejects the boundary value', () => {
    const schema = { type: 'number', minimum: 0, exclusiveMinimum: true }
    expect(validateWorkshopInput(0, schema)).toBe(false)
    expect(validateWorkshopInput(0.1, schema)).toBe(true)
    expect(schema.exclusiveMinimum).toBe(true)
  })

  it('limits nullable to a declared type and does not rewrite example data', () => {
    const schema = {
      nullable: true,
      properties: { text: { type: 'string', nullable: true } },
      example: { exclusiveMinimum: true, minimum: 1 }
    }
    expect(validateWorkshopInput({ text: null }, schema)).toBe(true)
    expect(normalizeOpenApiSchema(schema)).not.toHaveProperty('nullable')
    expect(normalizeOpenApiSchema(schema).example).toEqual(schema.example)
  })

  it('enforces declared URI and date-time formats', () => {
    expect(
      validateWorkshopInput('not a URL', { type: 'string', format: 'uri' })
    ).toBe(false)
    expect(
      validateWorkshopInput('https://example.com/input.png', {
        type: 'string',
        format: 'uri'
      })
    ).toBe(true)
    expect(
      validateWorkshopInput('tomorrow', { type: 'string', format: 'date-time' })
    ).toBe(false)
    expect(
      validateWorkshopInput('2026-09-09T12:00:00Z', {
        type: 'string',
        format: 'date-time'
      })
    ).toBe(true)
  })
})
