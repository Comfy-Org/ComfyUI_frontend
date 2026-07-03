import { describe, expect, it } from 'vitest'

import { buildApiSpec } from './apiSpec'
import { buildOpenApiDocument } from './openApiDocument'

interface OpenApiTestShape {
  paths: Record<string, unknown>
  components: {
    schemas: {
      Input: { properties: Record<string, unknown>; required?: string[] }
      Job: { properties: Record<string, unknown> }
    }
  }
}

describe('buildOpenApiDocument', () => {
  it('describes the submit and poll endpoints with a typed input schema', () => {
    const spec = buildApiSpec({
      title: 'Portrait Maker',
      workflowId: 'wf_test1',
      parameters: [
        {
          displayName: 'Steps',
          widgetType: 'number',
          value: 20,
          options: { precision: 0, min: 1, max: 100 }
        },
        {
          displayName: 'Image',
          widgetType: 'combo',
          value: 'photo.png',
          mediaKind: 'image',
          options: { values: ['photo.png'] }
        }
      ],
      outputs: [{ nodeId: '9', title: 'Save Image' }]
    })

    const document = buildOpenApiDocument(spec) as unknown as OpenApiTestShape

    expect(Object.keys(document.paths)).toEqual([
      '/workflows/wf_test1/run',
      '/jobs/{job_id}'
    ])

    expect(document.components.schemas.Input.properties.steps).toMatchObject({
      type: 'integer',
      default: 20,
      minimum: 1,
      maximum: 100
    })
    expect(document.components.schemas.Input.properties.image).toMatchObject({
      type: 'string',
      format: 'uri'
    })
    expect(
      document.components.schemas.Input.properties.image
    ).not.toHaveProperty('enum')
    expect(document.components.schemas.Input.required).toEqual(['image'])
    expect(document.components.schemas.Job.properties.outputs).toMatchObject({
      type: 'object',
      properties: {
        save_image: {
          type: 'array',
          items: { $ref: '#/components/schemas/OutputAsset' }
        }
      }
    })
  })
})
