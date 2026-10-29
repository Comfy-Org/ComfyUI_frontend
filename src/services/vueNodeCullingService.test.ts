import { describe, expect, it, onTestFinished } from 'vitest'

import {
  isNodeExcludedFromCulling,
  isNodeTypeExcludedFromCulling,
  registerNodeCullingOptOut,
  registerNodeTypeCullingOptOut
} from '@/services/vueNodeCullingService'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

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

  it('excludes only the registered node instance until release', () => {
    const registeredNodeId = toNodeId(12)
    const otherNodeId = toNodeId(13)
    const release = registerNodeCullingOptOut(registeredNodeId)
    onTestFinished(release)

    expect(isNodeExcludedFromCulling(registeredNodeId, 'shared-type')).toBe(
      true
    )
    expect(isNodeExcludedFromCulling(otherNodeId, 'shared-type')).toBe(false)

    release()
    expect(isNodeExcludedFromCulling(registeredNodeId, 'shared-type')).toBe(
      false
    )
  })
})
