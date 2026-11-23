import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import '@/scripts/domWidget'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  DefRegistry,
  NodeCreatedEvent,
  NodeDefBuilder,
  PackId
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

vi.mock(import('@/services/litegraphService'))

const TYPE = 'Pack/Joined'

describe('which nodes an extension reaches', () => {
  let graph: LGraph
  let defs: DefRegistry
  let host: ComfyApiHost

  let packId: PackId

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    packId = registerTestPack(api)
    defs = api.comfy.defs
    host = api.host
    registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return defs.extend(packId, TYPE, apply)
  }

  function create(): LGraphNode {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
    return node
  }

  function added(): LGraphNode {
    const node = create()
    graph.add(node)
    return node
  }

  function withDomWidget(node: LGraphNode): LGraphNode {
    node.addDOMWidget('text', 'customtext', document.createElement('div'), {})
    return node
  }

  function source(): LGraphNode {
    const node = new LGraphNode('Source')
    node.addOutput('out', '*')
    graph.add(node)
    return node
  }

  function canvasShowing(): LGraphCanvas {
    const element = document.createElement('canvas')
    element.width = 800
    element.height = 600
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    element.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
    return new LGraphCanvas(element, graph, {
      skip_render: true,
      skip_events: true
    })
  }

  describe('a drag over a node', () => {
    it('asks the hook of a node that joined after the extension, not of one already there', () => {
      const existing = added()
      const asked: string[] = []
      extend((builder) =>
        builder.onDragOver((handle) => {
          asked.push(handle.id)
          return true
        })
      )
      const later = added()
      const event = new DragEvent('dragover')

      expect(existing.onDragOver?.(event)).toBe(false)
      expect(later.onDragOver?.(event)).toBe(true)
      expect(asked).toEqual([String(later.id)])
    })

    it('does not ask the hook of a node whose drag handling the host set on the node itself', () => {
      const asked: string[] = []
      extend((builder) =>
        builder.onDragOver((handle) => {
          asked.push(handle.id)
          return false
        })
      )
      const control = added()
      const uploading = added()
      useNodeDragAndDrop(uploading, { onDrop: async () => [] })
      const event = new DragEvent('dragover')

      control.onDragOver?.(event)
      uploading.onDragOver?.(event)

      expect(asked).toEqual([String(control.id)])
    })
  })

  describe('a drop on a node', () => {
    it('asks the hook of a node that joined after the extension, not of one already there', async () => {
      const existing = added()
      const asked: string[] = []
      extend((builder) =>
        builder.onDrop((handle) => {
          asked.push(handle.id)
          return true
        })
      )
      const later = added()
      const event = new DragEvent('drop')

      await expect(existing.onDragDrop?.(event)).resolves.toBe(false)
      await expect(later.onDragDrop?.(event)).resolves.toBe(true)
      expect(asked).toEqual([String(later.id)])
    })

    it('does not ask the hook of a node whose drop handling the host set on the node itself', async () => {
      const asked: string[] = []
      extend((builder) =>
        builder.onDrop((handle) => {
          asked.push(handle.id)
          return false
        })
      )
      const control = added()
      const uploading = added()
      useNodeDragAndDrop(uploading, { onDrop: async () => [] })
      const event = new DragEvent('drop')

      await control.onDragDrop?.(event)
      await uploading.onDragDrop?.(event)

      expect(asked).toEqual([String(control.id)])
    })
  })

  describe('made before and after the node joined', () => {
    it('reaches a node that joins after it and not one that was already there', () => {
      const existing = added()
      const removed: string[] = []
      extend((builder) =>
        builder.onRemoved((handle) => removed.push(handle.id))
      )
      const later = added()

      graph.remove(existing)
      graph.remove(later)

      expect(removed).toEqual([String(later.id)])
    })

    it('does not reach, by any hook, a node already there, even through the class prototype', () => {
      const existing = added()
      existing.addInput('in', '*')
      const heard: string[] = []
      extend((builder) => {
        builder.onConnectionsChanged(() => heard.push('connections'))
        builder.onResized(() => heard.push('resized'))
        builder.onPropertyChanged(() => heard.push('property'))
        builder.onExecuted(() => heard.push('executed'))
        builder.onRemoved(() => heard.push('removed'))
        builder.addMenuItem({ label: 'Entry', run: () => {} })
      })

      source().connect(0, existing, 0)
      existing.setSize([300, 200])
      existing.setProperty('x', 1)
      existing.onExecuted?.({ text: ['a'] })
      const menu = host.nodeTypeHooks.getNodeMenuItems(existing)
      graph.remove(existing)

      expect(heard).toEqual([])
      expect(menu).toEqual([])
    })

    it('reaches every hook of a node that joined after it', () => {
      extend(() => {})
      const heard: string[] = []
      extend((builder) => {
        builder.onConnectionsChanged(() => heard.push('connections'))
        builder.onResized(() => heard.push('resized'))
        builder.onPropertyChanged(() => heard.push('property'))
        builder.onExecuted(() => heard.push('executed'))
        builder.onRemoved(() => heard.push('removed'))
        builder.addMenuItem({ label: 'Entry', run: () => {} })
      })
      const node = added()
      node.addInput('in', '*')
      heard.length = 0

      source().connect(0, node, 0)
      node.setSize([300, 200])
      node.setProperty('x', 1)
      node.onExecuted?.({ text: ['a'] })
      const menu = host.nodeTypeHooks.getNodeMenuItems(node)
      graph.remove(node)

      expect(heard).toEqual([
        'connections',
        'resized',
        'property',
        'executed',
        'connections',
        'removed'
      ])
      expect(menu.map((entry) => entry.content)).toEqual(['Entry'])
    })

    it('does not tell onCreated of a node that already exists', () => {
      added()
      const onCreated = vi.fn()

      extend((builder) => builder.onCreated(onCreated))
      added()

      expect(onCreated).toHaveBeenCalledOnce()
    })

    it('judges each extension by itself: a node hears those made before it joined only', () => {
      const first = vi.fn()
      const second = vi.fn()
      const third = vi.fn()
      extend((builder) => builder.onRemoved(first))
      const middle = added()
      extend((builder) => builder.onRemoved(second))
      const last = added()
      extend((builder) => builder.onRemoved(third))

      graph.remove(middle)
      graph.remove(last)

      expect(
        [first, second, third].map((hook) => hook.mock.calls.length)
      ).toEqual([2, 1, 0])
    })

    it('does not reach the node being created through an extension made inside its onCreated', () => {
      const late = vi.fn()
      extend((builder) =>
        builder.onCreated(() => {
          extend((inner) => inner.onRemoved(late))
        })
      )
      const node = added()

      graph.remove(node)

      expect(late).not.toHaveBeenCalled()
    })
  })

  describe('a node that came to the graph in each way the host has', () => {
    function heardRemovals() {
      const removed: unknown[] = []
      extend((builder) =>
        builder.onRemoved((handle) => removed.push(handle.type))
      )
      return removed
    }

    it('hears a node a load made after the extension, and not one the load made before it', () => {
      const first = heardRemovals()
      added()
      graph.configure(graph.serialize())
      const second = vi.fn()
      extend((builder) => builder.onRemoved(second))

      graph.configure(graph.serialize())
      expect([first.length, second.mock.calls.length]).toEqual([2, 0])
      graph.configure(graph.serialize())

      expect([first.length, second.mock.calls.length]).toEqual([3, 1])
    })

    it('hears a node that undo or redo rebuilds as it hears a loaded one', () => {
      const removed = heardRemovals()
      added()
      const snapshot = graph.serialize()

      graph.configure(snapshot)
      graph.configure(snapshot)

      expect(removed).toEqual([TYPE, TYPE])
    })

    it('hears a pasted node', () => {
      const onCreated = vi.fn()
      extend((builder) => builder.onCreated(onCreated))
      const original = added()
      onCreated.mockClear()

      canvasShowing()._deserializeItems({ nodes: [original.serialize()] }, {})

      expect(onCreated).toHaveBeenCalledOnce()
    })

    it('hears a node in a subgraph, joined after the extension and not before', () => {
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const early = create()
      subgraph.add(early)
      const removed = vi.fn()
      extend((builder) => builder.onRemoved(removed))
      const later = create()
      subgraph.add(later)

      subgraph.remove(early)
      expect(removed).not.toHaveBeenCalled()
      subgraph.remove(later)

      expect(removed).toHaveBeenCalledOnce()
    })

    it('tells a loaded node it was restored', () => {
      const events: NodeCreatedEvent[] = []
      extend((builder) => builder.onCreated((_, event) => events.push(event)))
      added()

      graph.configure(graph.serialize())

      expect(events).toEqual([
        { restored: false, loading: false },
        { restored: true, loading: true }
      ])
    })
  })

  describe('a node that has a method of its own', () => {
    it('is not reached when it was already there, whoever made the copy', () => {
      const chained = added()
      chained.addInput('in', '*')
      const withWidget = withDomWidget(added())
      const stop = installErrorClearingHooks(graph)
      const heard: string[] = []
      extend((builder) => {
        builder.onConnectionsChanged(() => heard.push('connections'))
        builder.onResized(() => heard.push('resized'))
        builder.onRemoved(() => heard.push('removed'))
      })

      source().connect(0, chained, 0)
      withWidget.setSize([200, 120])
      graph.remove(withWidget)
      stop()

      expect(Object.hasOwn(chained, 'onConnectionsChange')).toBe(true)
      expect(Object.hasOwn(withWidget, 'onRemoved')).toBe(true)
      expect(heard).toEqual([])
    })

    it('is reached when it joined after the extension, with the copy the host made', () => {
      const stop = installErrorClearingHooks(graph)
      const heard: string[] = []
      extend((builder) => {
        builder.onConnectionsChanged(() => heard.push('connections'))
        builder.onResized(() => heard.push('resized'))
        builder.onRemoved(() => heard.push('removed'))
      })
      const chained = added()
      chained.addInput('in', '*')
      const withWidget = withDomWidget(added())
      heard.length = 0

      source().connect(0, chained, 0)
      withWidget.setSize([200, 120])
      graph.remove(withWidget)
      stop()

      expect(Object.hasOwn(chained, 'onConnectionsChange')).toBe(true)
      expect(Object.hasOwn(withWidget, 'onRemoved')).toBe(true)
      expect(heard).toEqual(['connections', 'resized', 'removed'])
    })

    it('stops hearing once a pack assigns a method over the dispatcher, as it would over any wrapper', () => {
      extend((builder) => builder.onRemoved(() => {}))
      const kept = vi.fn()
      extend((builder) => builder.onResized(kept))
      const replaced = added()
      const intact = added()
      const own = vi.fn()
      replaced.onResize = own

      replaced.setSize([200, 120])
      intact.setSize([200, 120])

      expect(own).toHaveBeenCalledOnce()
      expect(kept).toHaveBeenCalledOnce()
    })
  })

  describe('a class the host registered again', () => {
    it('is reached for nodes made from the new class only', () => {
      const earlier = added()
      registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
      const resized = vi.fn()
      extend((builder) => builder.onResized(resized))
      const current = added()

      earlier.setSize([180, 90])
      expect(resized).not.toHaveBeenCalled()
      current.setSize([180, 90])

      expect(resized).toHaveBeenCalledOnce()
    })
  })

  describe('after the method the node already had', () => {
    it('runs the class method first and then each extension in the order it was made', () => {
      const order: string[] = []
      LiteGraph.registered_node_types[TYPE].prototype.onRemoved = () => {
        order.push('class')
      }
      extend((builder) => builder.onRemoved(() => order.push('first')))
      extend((builder) => builder.onRemoved(() => order.push('second')))
      const node = added()

      graph.remove(node)

      expect(order).toEqual(['class', 'first', 'second'])
    })
  })

  describe('a node that left the graph', () => {
    it('hears nothing more', () => {
      const resized = vi.fn()
      extend((builder) => {
        builder.onResized(resized)
        builder.onRemoved(() => {})
      })
      const node = added()
      node.setSize([200, 200])
      const heardWhileIn = resized.mock.calls.length
      graph.remove(node)

      node.setSize([300, 300])

      expect([heardWhileIn, resized.mock.calls.length]).toEqual([1, 1])
    })
  })
})
