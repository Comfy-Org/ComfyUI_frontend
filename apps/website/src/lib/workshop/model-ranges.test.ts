import { describe, expect, it } from 'vitest'

import { durationsIn, resolutionRange } from './model-ranges'

describe('resolutionRange', () => {
  it.for([
    { resolutions: [], range: undefined },
    { resolutions: ['1080p'], range: '1080p' },
    { resolutions: ['4K', '1080p', '480p'], range: '480p – 4K' }
  ] as const)('reads $resolutions as $range', ({ resolutions, range }) => {
    expect(resolutionRange(resolutions)).toBe(range)
  })
})

describe('durationsIn', () => {
  it.for([
    {
      label: 'an enum of lengths',
      schema: { properties: { duration: { enum: ['5s', '10s'] } } },
      range: { min: 5, max: 10 }
    },
    {
      label: 'a minimum and maximum',
      schema: { properties: { duration: { minimum: 2, maximum: 12 } } },
      range: { min: 2, max: 12 }
    },
    {
      label: 'only a ceiling',
      schema: { properties: { duration: { maximum: 8 } } },
      range: { max: 8 }
    },
    {
      label: 'a sentinel for letting the model choose',
      schema: { properties: { duration: { enum: [-1, 4, 6] } } },
      range: { min: 4, max: 6 }
    },
    {
      label: 'a duration nested in a variant',
      schema: { anyOf: [{ properties: { duration: { enum: [3] } } }] },
      range: { min: 3, max: 3 }
    },
    {
      label: 'a schema with no duration',
      schema: { properties: { prompt: { type: 'string' } } },
      range: undefined
    },
    { label: 'no schema', schema: undefined, range: undefined }
  ])('reads $label', ({ schema, range }) => {
    expect(durationsIn(schema)).toEqual(range)
  })
})
