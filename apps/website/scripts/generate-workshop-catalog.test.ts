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
    expect(
      () => buildWorkshopCatalog([validModel, { ...validModel, id: undefined }])
      // The schema names both the offending index and the field. Which field
      // broke is the whole value of the message when a source change breaks
      // one model out of 268.
    ).toThrow(/Invalid partner model at index 1: id/)
  })

  it('rejects duplicate ids', () => {
    expect(() => buildWorkshopCatalog([validModel, validModel])).toThrow(
      'Duplicate partner model id'
    )
  })

  it('rejects distinct ids that map to the same route', () => {
    expect(() =>
      buildWorkshopCatalog([
        { ...validModel, id: 'provider--model/x' },
        { ...validModel, id: 'provider/model--x' }
      ])
    ).toThrow('Duplicate Workshop slug')
  })

  it('refuses input JSON cannot round-trip', () => {
    // z.unknown() accepted these and JSON.stringify then changed them:
    // a nested undefined disappears, NaN and Infinity become null. The
    // generator would have committed data its own validation never saw.
    // The message names the offending model and the exact field path.
    expect(() =>
      buildWorkshopCatalog([{ ...validModel, parameters: { nan: Number.NaN } }])
    ).toThrow(/index 0 \(provider\/model-v1\): parameters\.nan/)

    expect(() =>
      buildWorkshopCatalog([
        { ...validModel, parameters: { inf: Number.POSITIVE_INFINITY } }
      ])
    ).toThrow(/index 0 \(provider\/model-v1\): parameters\.inf/)
  })

  it('reports a malformed element instead of throwing on property access', () => {
    // A blind `as Record` cast used to make this a bare TypeError before the
    // schema ever ran, losing the index and the field name.
    expect(() => buildWorkshopCatalog([null])).toThrow(
      /Invalid partner model at index 0/
    )
    expect(() => buildWorkshopCatalog([42])).toThrow(
      /Invalid partner model at index 0/
    )
  })

  it('rejects malformed role extras instead of silently dropping them', () => {
    expect(() =>
      buildWorkshopCatalog([
        {
          ...validModel,
          roles: [{ ...validModel.roles[0], extras: 'invalid' }]
        }
      ])
    ).toThrow(/index 0 \(provider\/model-v1\): roles\.0\.extras/)
  })

  it('produces the same lexically ordered output for every input order', () => {
    const models = [
      { ...validModel, id: 'p/a_a', display_name: 'Underscore' },
      { ...validModel, id: 'p/a0', display_name: 'Zero' }
    ]
    expect(buildWorkshopCatalog(models).map((m) => m.id)).toEqual([
      'p/a0',
      'p/a_a'
    ])
    expect(buildWorkshopCatalog(models.toReversed())).toEqual(
      buildWorkshopCatalog(models)
    )
  })
})
