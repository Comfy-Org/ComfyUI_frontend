import { describe, expect, it, onTestFinished } from 'vitest'

import {
  isNodeTypeExcludedFromCulling,
  registerNodeTypeCullingOptOut
} from '@/services/vueNodeCullingService'

describe('vueNodeCullingService', () => {
  it('excludes a type while at least one registration holds', () => {
    const first = registerNodeTypeCullingOptOut('shared-type')
    onTestFinished(first)
    const second = registerNodeTypeCullingOptOut('shared-type')
    onTestFinished(second)
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    first()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(true)

    second()
    expect(isNodeTypeExcludedFromCulling('shared-type')).toBe(false)
  })

  it('makes release idempotent', () => {
    const mine = registerNodeTypeCullingOptOut('idempotent-type')
    onTestFinished(mine)
    const theirs = registerNodeTypeCullingOptOut('idempotent-type')
    onTestFinished(theirs)

    mine()
    mine()
    expect(isNodeTypeExcludedFromCulling('idempotent-type')).toBe(true)

    theirs()
    expect(isNodeTypeExcludedFromCulling('idempotent-type')).toBe(false)
  })
})
