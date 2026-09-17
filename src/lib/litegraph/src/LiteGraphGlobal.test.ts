import { describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

class RegisteredNode extends LGraphNode {}

describe('LiteGraph.subscribeNodeTypeRegistered', () => {
  it('isolates a throwing listener and still notifies the others', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = vi.fn(() => {
      throw new Error('listener failed')
    })
    const second = vi.fn()
    const stopFailing = LiteGraph.subscribeNodeTypeRegistered(failing)
    const stopSecond = LiteGraph.subscribeNodeTypeRegistered(second)
    try {
      expect(() =>
        LiteGraph.registerNodeType('subscribed-type', RegisteredNode)
      ).not.toThrow()
      expect(LiteGraph.registered_node_types['subscribed-type']).toBe(
        RegisteredNode
      )
      expect(second).toHaveBeenCalledWith('subscribed-type', RegisteredNode)
      expect(consoleError).toHaveBeenCalledOnce()
    } finally {
      stopFailing()
      stopSecond()
      LiteGraph.unregisterNodeType('subscribed-type')
      consoleError.mockRestore()
    }
  })

  it('stops delivering after unsubscribe and survives a legacy callback swap', () => {
    const listener = vi.fn()
    const legacy = vi.fn()
    const previous = LiteGraph.onNodeTypeRegistered
    const stop = LiteGraph.subscribeNodeTypeRegistered(listener)
    try {
      LiteGraph.onNodeTypeRegistered = legacy
      LiteGraph.registerNodeType('subscribed-type', RegisteredNode)
      expect(legacy).toHaveBeenCalledWith('subscribed-type', RegisteredNode)
      expect(listener).toHaveBeenCalledTimes(1)

      stop()
      LiteGraph.registerNodeType('subscribed-type', RegisteredNode)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(legacy).toHaveBeenCalledTimes(2)
    } finally {
      stop()
      LiteGraph.onNodeTypeRegistered = previous
      LiteGraph.unregisterNodeType('subscribed-type')
    }
  })

  it('notifies subscribers even when the legacy callback throws', () => {
    const listener = vi.fn()
    const previous = LiteGraph.onNodeTypeRegistered
    const stop = LiteGraph.subscribeNodeTypeRegistered(listener)
    try {
      LiteGraph.onNodeTypeRegistered = () => {
        throw new Error('legacy failed')
      }
      expect(() =>
        LiteGraph.registerNodeType('subscribed-type', RegisteredNode)
      ).toThrow('legacy failed')
      expect(LiteGraph.registered_node_types['subscribed-type']).toBe(
        RegisteredNode
      )
      expect(listener).toHaveBeenCalledWith('subscribed-type', RegisteredNode)
    } finally {
      stop()
      LiteGraph.onNodeTypeRegistered = previous
      LiteGraph.unregisterNodeType('subscribed-type')
    }
  })
})
