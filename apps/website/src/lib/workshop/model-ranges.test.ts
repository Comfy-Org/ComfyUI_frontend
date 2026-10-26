import { describe, expect, it } from 'vitest'

import { durationsIn, resolutionRange } from './model-ranges'

describe('resolutionRange', () => {
  it.for([
    { resolutions: ['2K', '1K'], range: '1K – 2K' },
    { resolutions: ['4K', '1080p', '720p', '480p'], range: '480p – 4K' },
    { resolutions: ['1080p'], range: '1080p' },
    { resolutions: [], range: undefined },
    { resolutions: undefined, range: undefined }
  ] as const)('reads $resolutions as $range', ({ resolutions, range }) => {
    expect(resolutionRange(resolutions)).toBe(range)
  })
})

const schemaWith = (duration: unknown) => ({
  type: 'object',
  properties: { prompt: { type: 'string' }, duration }
})

describe('durationsIn', () => {
  it.for([
    {
      name: 'a numeric enum',
      duration: { type: 'integer', enum: [5, 10] },
      range: { min: 5, max: 10 }
    },
    {
      name: 'numeric strings',
      duration: { type: 'string', enum: ['3', '4', '15'] },
      range: { min: 3, max: 15 }
    },
    {
      name: 'second-suffixed strings inside anyOf',
      duration: { anyOf: [{ enum: ['5s', '9s'], type: 'string' }] },
      range: { min: 5, max: 9 }
    },
    {
      name: 'a minimum and maximum',
      duration: { type: 'integer', minimum: 4, maximum: 30 },
      range: { min: 4, max: 30 }
    },
    {
      name: 'a -1 sentinel among the choices',
      duration: { anyOf: [{ enum: [-1] }, { enum: [4, 8, 12] }] },
      range: { min: 4, max: 12 }
    },
    {
      name: 'a -1 sentinel as the minimum',
      duration: { type: 'integer', minimum: -1, maximum: 30 },
      range: { max: 30 }
    },
    {
      name: 'a single choice',
      duration: { enum: [6] },
      range: { min: 6, max: 6 }
    },
    {
      name: 'no bounds at all',
      duration: { type: 'number', description: 'Seconds' },
      range: undefined
    },
    { name: 'no duration input', duration: undefined, range: undefined }
  ])('reads $name', ({ duration, range }) => {
    expect(durationsIn(schemaWith(duration))).toEqual(range)
  })

  it('reads nothing from a missing schema', () => {
    expect(durationsIn(undefined)).toBeUndefined()
  })
})
