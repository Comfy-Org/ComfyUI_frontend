import { describe, expect, it } from 'vitest'

import { buildWorkshopCatalog } from './generate-workshop-catalog'

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
        roles: validModel.roles
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
