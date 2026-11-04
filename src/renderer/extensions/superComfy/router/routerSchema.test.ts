import { assert, describe, expect, it } from 'vitest'

import type { Modality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { fixtureDoc } from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import {
  flattenSchema,
  parseOpenApiDoc,
  primaryModality,
  requestSchemaOf,
  schemaAt
} from '@/renderer/extensions/superComfy/router/routerSchema'
import type {
  JsonSchema,
  OpenApiDoc
} from '@/renderer/extensions/superComfy/router/routerTypes'

function docWithSchemas(schemas: Record<string, JsonSchema>): OpenApiDoc {
  return { components: { schemas } }
}

describe('flattenSchema', () => {
  it('resolves a $ref and keeps the fields set beside it', () => {
    const doc = docWithSchemas({
      Ratio: { type: 'string', enum: ['1:1', '16:9'], description: 'shared' }
    })

    expect(
      flattenSchema(doc, {
        $ref: '#/components/schemas/Ratio',
        description: 'own'
      })
    ).toEqual({ type: 'string', enum: ['1:1', '16:9'], description: 'own' })
  })

  it('lets a later allOf entry replace an earlier property', () => {
    const doc = fixtureDoc('byteplus/dreamina-seedance-2-0-260128')
    const request = requestSchemaOf(doc)
    assert.exists(request)

    expect(schemaAt(doc, request, ['duration'])?.enum).toEqual([
      -1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
    ])
    expect(schemaAt(doc, request, ['content'])?.type).toBe('array')
  })

  it.for<{ name: string; schema: JsonSchema; expected: JsonSchema }>([
    {
      name: 'a nullable range collapses to the range and is marked nullable',
      schema: {
        description: 'Seed',
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9 }, { type: 'null' }]
      },
      expected: {
        type: 'integer',
        minimum: 0,
        maximum: 9,
        description: 'Seed',
        nullable: true
      }
    },
    {
      name: 'an object branch wins over a string branch',
      schema: {
        oneOf: [
          { type: 'string' },
          { type: 'object', properties: { url: { type: 'string' } } }
        ]
      },
      expected: {
        type: 'object',
        properties: { url: { type: 'string' } },
        nullable: false
      }
    },
    {
      name: 'enum branches join into one enum',
      schema: { anyOf: [{ enum: ['a'] }, { enum: ['b', 'c'] }] },
      expected: { enum: ['a', 'b', 'c'], nullable: false }
    }
  ])('$name', ({ schema, expected }) => {
    expect(flattenSchema(docWithSchemas({}), schema)).toEqual(expected)
  })

  it('keeps the properties of a schema that also has a union', () => {
    const doc = fixtureDoc('byteplus/seedream-5-0-260128')

    const raw = requestSchemaOf(doc)
    assert.exists(raw)

    const request = flattenSchema(doc, raw)

    expect(Object.keys(request.properties ?? {})).toEqual(
      expect.arrayContaining(['prompt', 'image'])
    )
  })
})

describe('primaryModality', () => {
  it.for<{ outputs: string[]; expected: Modality | null }>([
    { outputs: ['video', 'audio'], expected: 'video' },
    { outputs: ['image', 'text'], expected: 'image' },
    { outputs: ['text', '3d'], expected: '3d' },
    { outputs: ['audio', 'text'], expected: 'audio' },
    { outputs: ['text'], expected: 'text' },
    { outputs: [], expected: null }
  ])('$outputs gives $expected', ({ outputs, expected }) => {
    expect(primaryModality(outputs)).toBe(expected)
  })
})

describe('parseOpenApiDoc', () => {
  it.for([
    { name: 'a string', raw: 'not a schema' },
    { name: 'a document with no request body', raw: { paths: { '/x': {} } } }
  ])('refuses $name', ({ raw }) => {
    expect(parseOpenApiDoc(raw)).toBeNull()
  })
})
