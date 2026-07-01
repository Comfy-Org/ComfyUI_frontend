import { describe, expect, it } from 'vitest'

import { buildOpenApiSpec } from './buildOpenApiSpec'

interface SpecNode {
  [key: string]: SpecNode
}

const asSpec = (spec: Record<string, unknown>) => spec as unknown as SpecNode

describe('buildOpenApiSpec', () => {
  it('builds a request schema from typed inputs', () => {
    const spec = asSpec(
      buildOpenApiSpec({
        title: 'My Flow',
        inputs: [
          { name: 'text', type: 'STRING', default: 'hello' },
          { name: 'seed', type: 'INT', default: 0, minimum: 0, maximum: 100 },
          {
            name: 'sampler',
            type: 'COMBO',
            default: 'euler',
            options: ['euler', 'ddim']
          }
        ],
        outputs: ['9']
      })
    )

    const schema =
      spec.paths['/api/workflow/generate'].post.requestBody.content[
        'application/json'
      ].schema

    expect(spec.info.title).toBe('My Flow API')
    expect(schema.properties.text).toEqual({ type: 'string', default: 'hello' })
    expect(schema.properties.seed).toEqual({
      type: 'integer',
      minimum: 0,
      maximum: 100,
      default: 0
    })
    expect(schema.properties.sampler).toEqual({
      type: 'string',
      enum: ['euler', 'ddim'],
      default: 'euler'
    })
  })

  it('marks inputs without a default as required', () => {
    const spec = asSpec(
      buildOpenApiSpec({
        title: 'Flow',
        inputs: [
          { name: 'required_field', type: 'STRING' },
          { name: 'optional_field', type: 'STRING', default: 'x' }
        ],
        outputs: []
      })
    )

    const schema =
      spec.paths['/api/workflow/generate'].post.requestBody.content[
        'application/json'
      ].schema

    expect(schema.required).toEqual(['required_field'])
  })

  it('describes selected outputs in the response', () => {
    const spec = asSpec(
      buildOpenApiSpec({
        title: 'Flow',
        inputs: [],
        outputs: ['9', '12']
      })
    )

    const outputs =
      spec.paths['/api/workflow/generate'].post.responses['200'].content[
        'application/json'
      ].schema.properties.outputs

    expect(Object.keys(outputs.properties)).toEqual(['9', '12'])
    expect(outputs.properties['9'].type).toBe('array')
  })
})
