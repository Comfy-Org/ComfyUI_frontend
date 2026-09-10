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
    // The build-time check rejects a misspelling before a build; at runtime
    // the safe answer is the family that cannot reach production.
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
  it('accepts exactly the three families', () => {
    expect(isWorkshopCloudEnv('prod')).toBe(true)
    expect(isWorkshopCloudEnv('staging')).toBe(true)
    expect(isWorkshopCloudEnv('test')).toBe(true)
    expect(isWorkshopCloudEnv('Prod')).toBe(false)
    expect(isWorkshopCloudEnv('')).toBe(false)
    expect(isWorkshopCloudEnv(undefined)).toBe(false)
  })
})
