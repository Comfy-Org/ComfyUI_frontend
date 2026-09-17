import { describe, expect, it } from 'vitest'

import { brandIdentity, identityBrand, isAccountIdentity } from './identity.js'

describe('isAccountIdentity', () => {
  it('accepts a port branded through the package entry', () => {
    const identity = brandIdentity({ onUserChanged: () => () => undefined })

    expect(
      isAccountIdentity(identity),
      'a port branded by the package must satisfy the full contract'
    ).toBe(true)
  })

  it('rejects a forged brand key whose value is not the literal true', () => {
    const forged = {
      onUserChanged: () => () => undefined,
      [identityBrand]: false
    }

    expect(
      isAccountIdentity(forged),
      'the brand must hold the literal true, not merely be present as a key'
    ).toBe(false)
  })

  it('rejects a branded object missing the onUserChanged method', () => {
    const brandOnly = { [identityBrand]: true }

    expect(
      isAccountIdentity(brandOnly),
      'the guard promises onUserChanged, so a branded object without it must fail'
    ).toBe(false)
  })

  it('rejects a branded object whose onUserChanged is not callable', () => {
    const wrongMethod = {
      onUserChanged: 'not a function',
      [identityBrand]: true
    }

    expect(
      isAccountIdentity(wrongMethod),
      'onUserChanged must be a function for the guard to claim the contract'
    ).toBe(false)
  })

  it('rejects non-object values', () => {
    expect(isAccountIdentity(null)).toBe(false)
    expect(isAccountIdentity(undefined)).toBe(false)
    expect(isAccountIdentity('branded')).toBe(false)
  })
})
