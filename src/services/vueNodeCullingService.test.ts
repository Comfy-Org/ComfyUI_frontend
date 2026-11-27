import { describe, expect, it, onTestFinished } from 'vitest'

import {
  isNodeExcludedFromCulling,
  registerNodeCullingOptOut
} from '@/services/vueNodeCullingService'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

describe('vueNodeCullingService', () => {
  it('excludes a node while at least one registration holds', () => {
    const nodeId = toNodeId(12)
    const first = registerNodeCullingOptOut(nodeId)
    onTestFinished(first)
    const second = registerNodeCullingOptOut(nodeId)
    onTestFinished(second)

    first()
    first()
    expect(isNodeExcludedFromCulling(nodeId)).toBe(true)
    expect(isNodeExcludedFromCulling(toNodeId(13))).toBe(false)

    second()
    expect(isNodeExcludedFromCulling(nodeId)).toBe(false)
  })
})
