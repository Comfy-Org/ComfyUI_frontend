import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import '@/scripts/domWidget'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { DefRegistry, NodeDefBuilder } from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

const TYPE = 'Pack/Late'

describe('an extension made after nodes exist', () => {
  let graph: LGraph
  let defs: DefRegistry
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    defs = api.comfy.defs
    host = api.host
    registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return defs.extend(TYPE, apply)
  }

  function added(): LGraphNode {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
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

  describe('through a method the host gave the node itself', () => {
    it('hears a link made to a node the error hooks chained', () => {
      const target = added()
      target.addInput('in', '*')
      const stop = installErrorClearingHooks(graph)
      const onConnectionsChanged = vi.fn()
      extend((builder) => builder.onConnectionsChanged(onConnectionsChanged))

      source().connect(0, target, 0)
      stop()

      expect(Object.hasOwn(target, 'onConnectionsChange')).toBe(true)
      expect(onConnectionsChanged).toHaveBeenCalledOnce()
    })

    it('hears a node with a DOM widget leave and resize', () => {
      const node = withDomWidget(added())
      const onRemoved = vi.fn()
      const onResized = vi.fn()
      extend((builder) => {
        builder.onRemoved(onRemoved)
        builder.onResized(onResized)
      })

      node.setSize([200, 120])
      graph.remove(node)

      expect(Object.hasOwn(node, 'onRemoved')).toBe(true)
      expect(onResized).toHaveBeenCalledOnce()
      expect(onRemoved).toHaveBeenCalledOnce()
    })

    it('calls each hook once on a node that joined after the hook was first asked for', () => {
      const early = vi.fn()
      extend((builder) => builder.onRemoved(early))
      const node = withDomWidget(added())
      const late = vi.fn()
      extend((builder) => builder.onRemoved(late))

      graph.remove(node)

      expect([early.mock.calls.length, late.mock.calls.length]).toEqual([1, 1])
    })

    it('leaves the nodes of other types alone', () => {
      registerHostType(host.nodeTypeHooks, hostNodeDef('Pack/Other'))
      const other = LiteGraph.createNode('Pack/Other')
      assert(other)
      graph.add(withDomWidget(other))
      const onRemoved = vi.fn()
      extend((builder) => builder.onRemoved(onRemoved))

      graph.remove(other)

      expect(onRemoved).not.toHaveBeenCalled()
      expect(Object.hasOwn(other, 'onRemoved')).toBe(true)
    })

    it('leaves a node outside the open document alone', () => {
      const elsewhere = new LGraph()
      const node = LiteGraph.createNode(TYPE)
      assert(node)
      elsewhere.add(withDomWidget(node))
      const onRemoved = vi.fn()
      extend((builder) => builder.onRemoved(onRemoved))

      elsewhere.remove(node)

      expect(onRemoved).not.toHaveBeenCalled()
    })
  })

  describe('of a class the host has registered again since', () => {
    it('hears the nodes made from the earlier class, and shows them its menu', () => {
      const earlier = added()
      registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
      const onResized = vi.fn()
      extend((builder) => {
        builder.onResized(onResized)
        builder.addMenuItem({ label: 'Late entry', run: () => {} })
      })

      earlier.setSize([180, 90])
      const menu = host.nodeTypeHooks.getNodeMenuItems(earlier)

      expect(onResized).toHaveBeenCalledOnce()
      expect(menu.map((entry) => entry.content)).toEqual(['Late entry'])
    })
  })
})
