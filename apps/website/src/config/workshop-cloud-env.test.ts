import { describe, expect, it } from 'vitest'

import {
  isWorkshopCloudEnv,
  resolveWorkshopCloudEnv
} from './workshop-cloud-env'

describe('resolveWorkshopCloudEnv', () => {
  it.for([
    { name: 'unset means staging', value: undefined, expected: 'staging' },
    { name: 'empty means staging', value: '', expected: 'staging' },
    { name: 'prod is prod', value: 'prod', expected: 'prod' },
    { name: 'staging is staging', value: 'staging', expected: 'staging' },
    { name: 'test is test', value: 'test', expected: 'test' },
    // Workshop builds reject a misspelling before building; at runtime the
    // safe answer is the family that cannot reach production.
    {
      name: 'anything else stays on staging',
      value: 'production',
      expected: 'staging'
    }
  ])('$name', ({ value, expected }) => {
    expect(resolveWorkshopCloudEnv(value)).toBe(expected)
  })
})

describe('isWorkshopCloudEnv', () => {
  it.for([
    { name: 'prod is valid', value: 'prod', expected: true },
    { name: 'staging is valid', value: 'staging', expected: true },
    { name: 'test is valid', value: 'test', expected: true },
    { name: 'family names are case-sensitive', value: 'Prod', expected: false },
    { name: 'empty is invalid', value: '', expected: false },
    { name: 'unset is invalid', value: undefined, expected: false }
  ])('$name', ({ value, expected }) => {
    expect(isWorkshopCloudEnv(value)).toBe(expected)
  })
})
