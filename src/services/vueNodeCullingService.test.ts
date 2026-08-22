import { describe, expect, it } from 'vitest'

import {
  isNodeTypeExcludedFromCulling,
  registerNodeTypeCullingOptOut
} from '@/services/vueNodeCullingService'

describe('vueNodeCullingService', () => {
  it('excludes a type while at least one registration holds', () => {
    // Ref-counted: two extensions may register the same type, and the first
    // to release must not strip protection the second still relies on.
    const first = registerNodeTypeCullingOptOut('shared-type')
    const second = registerNodeTypeCullingOptOut('shared-type')
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    first()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    second()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(false)
  })

  it('makes release idempotent', () => {
    // A double release from one registrant must not consume another's count.
    const mine = registerNodeTypeCullingOptOut('idempotent-type')
    const theirs = registerNodeTypeCullingOptOut('idempotent-type')

    mine()
    mine()
    expect(isNodeTypeExcludedFromCulling('idempotent-type')).toBe(true)

    theirs()
    expect(isNodeTypeExcludedFromCulling('idempotent-type')).toBe(false)
  })

  it('does not exclude unregistered types', () => {
    expect(isNodeTypeExcludedFromCulling('never-registered')).toBe(false)
  })
})
