import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  NodeEvent,
  onAllNodeEvents,
  offAllNodeEvents
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'

function createGraph(): LGraph {
  return new LGraph()
}

function createConnectedNodes(graph: LGraph) {
  const source = new LGraphNode('Source')
  source.addOutput('out', 'number')
  const target = new LGraphNode('Target')
  target.addInput('in', 'number')
  graph.add(source)
  graph.add(target)
  return { source, target }
}

describe('NodeEventEmitter', () => {
  let origLiteGraph: typeof LiteGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    origLiteGraph = Object.assign({}, LiteGraph)
    // @ts-expect-error Intended: Force remove an otherwise readonly non-optional property
    delete origLiteGraph.Classes

    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14,
      DEFAULT_SHADOW_COLOR: 'rgba(0,0,0,0.5)',
      DEFAULT_GROUP_FONT_SIZE: 24,
      isValidConnection: vi.fn().mockReturnValue(true)
    })
  })

  afterEach(() => {
    Object.assign(LiteGraph, origLiteGraph)
  })

  describe('instance-level on/off/emit', () => {
    test('fires listener when event is emitted', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.NODE_CREATED, listener)
      node.emit(NodeEvent.NODE_CREATED)

      expect(listener).toHaveBeenCalledOnce()
    })

    test('passes detail payload to listener', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.EXECUTED, listener)
      node.emit(NodeEvent.EXECUTED, { output: { text: ['hello'] } })

      expect(listener).toHaveBeenCalledWith({ output: { text: ['hello'] } })
    })

    test('supports multiple listeners on the same event', () => {
      const node = new LGraphNode('Test')
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      node.on(NodeEvent.EXECUTED, listener1)
      node.on(NodeEvent.EXECUTED, listener2)
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener1).toHaveBeenCalledOnce()
      expect(listener2).toHaveBeenCalledOnce()
    })

    test('removes listener with off()', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.EXECUTED, listener)
      node.off(NodeEvent.EXECUTED, listener)
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })

    test('on() returns an unsubscribe function', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      const unsub = node.on(NodeEvent.EXECUTED, listener)
      unsub()
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })

    test('does not fire listeners for other event types', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.EXECUTED, listener)
      node.emit(NodeEvent.NODE_CREATED)

      expect(listener).not.toHaveBeenCalled()
    })

    test('isolates listeners between node instances', () => {
      const node1 = new LGraphNode('A')
      const node2 = new LGraphNode('B')
      const listener = vi.fn()

      node1.on(NodeEvent.EXECUTED, listener)
      node2.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('once()', () => {
    test('fires listener only once', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.once(NodeEvent.EXECUTED, listener)
      node.emit(NodeEvent.EXECUTED, { output: { a: 1 } })
      node.emit(NodeEvent.EXECUTED, { output: { a: 2 } })

      expect(listener).toHaveBeenCalledOnce()
      expect(listener).toHaveBeenCalledWith({ output: { a: 1 } })
    })

    test('returns an unsubscribe function that cancels before firing', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      const unsub = node.once(NodeEvent.EXECUTED, listener)
      unsub()
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })

    test('does not interfere with other listeners', () => {
      const node = new LGraphNode('Test')
      const onceListener = vi.fn()
      const permanentListener = vi.fn()

      node.once(NodeEvent.EXECUTED, onceListener)
      node.on(NodeEvent.EXECUTED, permanentListener)
      node.emit(NodeEvent.EXECUTED, { output: {} })
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(onceListener).toHaveBeenCalledOnce()
      expect(permanentListener).toHaveBeenCalledTimes(2)
    })
  })

  describe('class-level onAllNodeEvents', () => {
    afterEach(() => {
      LGraphNode._classEventListeners?.clear()
    })

    test('fires class-level listener on any instance emit', () => {
      const listener = vi.fn()
      onAllNodeEvents(LGraphNode, NodeEvent.EXECUTED, listener)

      const node = new LGraphNode('Test')
      node.emit(NodeEvent.EXECUTED, { output: { data: 1 } })

      expect(listener).toHaveBeenCalledWith({ output: { data: 1 } })
    })

    test('fires class-level listener with node as this', () => {
      let capturedThis: unknown
      const listener = function (this: unknown) {
        capturedThis = this
      }
      onAllNodeEvents(LGraphNode, NodeEvent.NODE_CREATED, listener)

      const node = new LGraphNode('Test')
      node.emit(NodeEvent.NODE_CREATED)

      expect(capturedThis).toBe(node)
    })

    test('fires both instance and class listeners', () => {
      const instanceListener = vi.fn()
      const classListener = vi.fn()

      onAllNodeEvents(LGraphNode, NodeEvent.EXECUTED, classListener)
      const node = new LGraphNode('Test')
      node.on(NodeEvent.EXECUTED, instanceListener)
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(instanceListener).toHaveBeenCalledOnce()
      expect(classListener).toHaveBeenCalledOnce()
    })

    test('removes class-level listener with offAllNodeEvents', () => {
      const listener = vi.fn()
      onAllNodeEvents(LGraphNode, NodeEvent.EXECUTED, listener)
      offAllNodeEvents(LGraphNode, NodeEvent.EXECUTED, listener)

      const node = new LGraphNode('Test')
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })

    test('onAllNodeEvents returns an unsubscribe function', () => {
      const listener = vi.fn()
      const unsub = onAllNodeEvents(LGraphNode, NodeEvent.EXECUTED, listener)
      unsub()

      const node = new LGraphNode('Test')
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('error isolation', () => {
    test('continues calling listeners if one throws', () => {
      const node = new LGraphNode('Test')
      const errorListener = vi.fn(() => {
        throw new Error('boom')
      })
      const normalListener = vi.fn()

      vi.spyOn(console, 'error').mockImplementation(() => {})

      node.on(NodeEvent.EXECUTED, errorListener)
      node.on(NodeEvent.EXECUTED, normalListener)
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(errorListener).toHaveBeenCalledOnce()
      expect(normalListener).toHaveBeenCalledOnce()
      expect(console.error).toHaveBeenCalledOnce()
    })
  })

  describe('automatic cleanup on node removal', () => {
    test('clears all listeners when node is removed from graph', () => {
      const graph = createGraph()
      const node = new LGraphNode('Test')
      graph.add(node)

      const listener = vi.fn()
      node.on(NodeEvent.EXECUTED, listener)

      graph.remove(node)
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })

    test('clears listeners on graph.clear()', () => {
      const graph = createGraph()
      const node = new LGraphNode('Test')
      graph.add(node)

      const listener = vi.fn()
      node.on(NodeEvent.EXECUTED, listener)

      graph.clear()
      node.emit(NodeEvent.EXECUTED, { output: {} })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('lifecycle event integration', () => {
    test('emits added when node is added to graph', () => {
      const graph = createGraph()
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.ADDED, listener)
      graph.add(node)

      expect(listener).toHaveBeenCalledOnce()
      expect(listener).toHaveBeenCalledWith({ graph })
    })

    test('emits removed when node is removed from graph', () => {
      const graph = createGraph()
      const node = new LGraphNode('Test')
      graph.add(node)

      const listener = vi.fn()
      node.on(NodeEvent.REMOVED, listener)
      graph.remove(node)

      expect(listener).toHaveBeenCalledOnce()
    })

    test('emits configured after node.configure()', () => {
      const node = new LGraphNode('Test')
      const graph = createGraph()
      graph.add(node)

      const listener = vi.fn()
      node.on(NodeEvent.CONFIGURED, listener)

      const serialised: ISerialisedNode = {
        id: node.id,
        type: 'Test',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0
      }
      node.configure(serialised)

      expect(listener).toHaveBeenCalledOnce()
      expect(listener).toHaveBeenCalledWith({
        serialisedNode: serialised
      })
    })

    test('emits resize when setSize is called', () => {
      const node = new LGraphNode('Test')
      const listener = vi.fn()

      node.on(NodeEvent.RESIZE, listener)
      node.setSize([200, 300])

      expect(listener).toHaveBeenCalledOnce()
      const detail = listener.mock.calls[0][0]
      expect(detail.size[0]).toBe(200)
      expect(detail.size[1]).toBe(300)
    })
  })

  describe('connections-change event', () => {
    test('emits on both nodes when connected', () => {
      const graph = createGraph()
      const { source, target } = createConnectedNodes(graph)
      const sourceListener = vi.fn()
      const targetListener = vi.fn()

      source.on(NodeEvent.CONNECTIONS_CHANGE, sourceListener)
      target.on(NodeEvent.CONNECTIONS_CHANGE, targetListener)

      source.connect(0, target, 0)

      expect(sourceListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 2, // NodeSlotType.OUTPUT
          index: 0,
          isConnected: true
        })
      )
      expect(targetListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 1, // NodeSlotType.INPUT
          index: 0,
          isConnected: true
        })
      )
    })

    test('emits on both nodes when disconnected', () => {
      const graph = createGraph()
      const { source, target } = createConnectedNodes(graph)
      source.connect(0, target, 0)

      const sourceListener = vi.fn()
      const targetListener = vi.fn()
      source.on(NodeEvent.CONNECTIONS_CHANGE, sourceListener)
      target.on(NodeEvent.CONNECTIONS_CHANGE, targetListener)

      target.disconnectInput(0)

      expect(sourceListener).toHaveBeenCalledWith(
        expect.objectContaining({
          isConnected: false
        })
      )
      expect(targetListener).toHaveBeenCalledWith(
        expect.objectContaining({
          isConnected: false
        })
      )
    })
  })
})
