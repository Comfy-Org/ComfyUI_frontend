import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from './litegraph'
import { prepareNodeConstruction } from './nodeConstruction'

describe('node construction', () => {
  const type = 'test/node-construction'

  beforeEach(() => {
    const catchExceptions = LiteGraph.catch_exceptions
    return () => {
      LiteGraph.catch_exceptions = catchExceptions
    }
  })

  it('returns null for a legacy constructor failure when exceptions are caught', () => {
    const cause = new Error('constructor failed')
    class BrokenNode extends LGraphNode {
      constructor() {
        super('Construction test')
        throw cause
      }
    }
    LiteGraph.registerNodeType(type, BrokenNode)
    LiteGraph.catch_exceptions = true

    expect(LiteGraph.createNode(type)).toBeNull()
  })

  it('propagates a legacy constructor failure when exceptions are not caught', () => {
    const cause = new Error('constructor failed')
    class BrokenNode extends LGraphNode {
      constructor() {
        super('Construction test')
        throw cause
      }
    }
    LiteGraph.registerNodeType(type, BrokenNode)
    LiteGraph.catch_exceptions = false

    expect(() => LiteGraph.createNode(type)).toThrow(cause)
  })

  it('propagates onNodeCreated failure even when constructor exceptions are caught', () => {
    const cause = new Error('onNodeCreated failed')
    class BrokenHookNode extends LGraphNode {
      override onNodeCreated() {
        throw cause
      }
    }
    LiteGraph.registerNodeType(type, BrokenHookNode)
    LiteGraph.catch_exceptions = true

    expect(() => LiteGraph.createNode(type)).toThrow(cause)
  })

  it('refuses a changed registration without running the prepared constructor', () => {
    const constructed = vi.fn()
    class OriginalNode extends LGraphNode {
      constructor() {
        super('Construction test')
        constructed()
      }
    }
    class ReplacementNode extends LGraphNode {}
    LiteGraph.registerNodeType(type, OriginalNode)
    const prepared = prepareNodeConstruction(LiteGraph, {
      type,
      graph: new LGraph()
    })
    assert(prepared.kind === 'ready')
    LiteGraph.registerNodeType(type, ReplacementNode)

    expect(prepared.construct()).toEqual({
      kind: 'refused',
      reason: 'stale-preparation',
      type
    })
    expect(constructed).not.toHaveBeenCalled()
  })
})
