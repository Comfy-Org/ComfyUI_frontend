import { describe, expect, it } from 'vitest'

import { API_VERSION, isApiVersionAtLeast } from './apiVersion'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

const [major, minor, patch] = API_VERSION

describe('API version', () => {
  it('is three whole numbers that cannot be changed', () => {
    expect(API_VERSION).toHaveLength(3)
    expect(API_VERSION.every(Number.isInteger)).toBe(true)
    expect(Object.isFrozen(API_VERSION)).toBe(true)
  })

  it.for([
    { name: 'itself', version: `v${major}.${minor}.${patch}` },
    { name: 'itself without the v', version: `${major}.${minor}.${patch}` },
    { name: 'an earlier patch of an earlier minor', version: `v${major}.0.0` },
    { name: 'an earlier major', version: `v${major - 1}.99.99` }
  ])('is at least $name', ({ version }) => {
    expect(isApiVersionAtLeast(version)).toBe(true)
  })

  it.for([
    { name: 'the next patch', version: `v${major}.${minor}.${patch + 1}` },
    { name: 'the next minor', version: `v${major}.${minor + 1}.0` },
    { name: 'the next major', version: `v${major + 1}.0.0` },
    { name: 'a major written with two digits', version: `v${major + 10}.0.0` }
  ])('is not at least $name', ({ version }) => {
    expect(isApiVersionAtLeast(version)).toBe(false)
  })

  it.for([
    '',
    'v',
    'v4',
    '4.0',
    'v4.0.0.0',
    'v4.x.0',
    'v4.0.',
    'latest',
    '4,0,0',
    ' v4.0.0',
    'v4.0.0 ',
    'V4.0.0',
    'v-4.0.0',
    'v.0.0',
    '4..0',
    '4.0.'
  ])('refuses %j, which is not written as a version', (version) => {
    expectRefusal(() => isApiVersionAtLeast(version), 'isApiVersionAtLeast')
  })

  it.for([undefined, null, 4, [4, 0, 0], new String('v4.0.0')])(
    'refuses %j from untyped code',
    (version) => {
      expectRefusal(
        () => Reflect.apply(isApiVersionAtLeast, undefined, [version]),
        'isApiVersionAtLeast'
      )
    }
  )

  it('names the call and what it was given when it refuses', () => {
    expect(() => isApiVersionAtLeast('4.0')).toThrow(
      "isApiVersionAtLeast needs a version written like v4.0.0, not '4.0'."
    )
  })
})
