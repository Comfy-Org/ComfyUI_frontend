import { describe, expect, it } from 'vitest'
import { workshopModelSchema } from './workshop-models.schema'

const model = {
  id: 'provider/model',
  slug: 'provider--model',
  displayName: 'Model',
  provider: 'provider',
  modality: 'image',
  description: '',
  tags: [],
  parameters: {},
  roles: [
    { role: 'image', required: false, cardinality: 'single', minItems: 0 }
  ]
}

describe('workshopModelSchema', () => {
  it('preserves base64 role metadata through JSON serialization', () => {
    const input = {
      ...model,
      roles: model.roles.map((role) => ({
        ...role,
        extras: [{ data: 'aGVsbG8=', media_type: 'image/png' }]
      }))
    }
    expect(
      JSON.parse(JSON.stringify(workshopModelSchema.parse(input)))
    ).toEqual(input)
  })

  it.for([undefined, NaN, Infinity, -Infinity])(
    'rejects non-JSON extras: %s',
    (value) => {
      const input = {
        ...model,
        roles: model.roles.map((role) => ({
          ...role,
          extras: [{ nested: { value } }]
        }))
      }
      expect(workshopModelSchema.safeParse(input).success).toBe(false)
    }
  )
})
