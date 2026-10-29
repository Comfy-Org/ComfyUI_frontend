import { describe, expect, it } from 'vitest'

import {
  isNodeTypeExcludedFromCulling,
  registerNodeTypeCullingOptOut
} from '@/services/vueNodeCullingService'

describe('vueNodeCullingService', () => {
  it('excludes a type while at least one registration holds', () => {
    const first = registerNodeTypeCullingOptOut('shared-type')
    const second = registerNodeTypeCullingOptOut('shared-type')
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    first()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    second()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(false)
  })

  it('makes release idempotent', () => {
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
