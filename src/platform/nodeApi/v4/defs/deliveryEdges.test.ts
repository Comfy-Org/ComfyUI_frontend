import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { DefRegistry, NodeDefBuilder } from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

const TYPE = 'Pack/Delivery'

describe('delivering hooks at the edges', () => {
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

  function addedNode(type = TYPE): LGraphNode {
    const node = LiteGraph.createNode(type)
    assert(node)
    graph.add(node)
    return node
  }

  it('does not call a hook another hook unsubscribed during the same delivery', () => {
    const second = vi.fn()
    let stopSecond = () => {}
    extend((builder) => builder.onCreated(() => stopSecond()))
    stopSecond = extend((builder) => builder.onCreated(second))
    const control = vi.fn()
    extend((builder) => builder.onCreated(control))

    addedNode()

    expect(second).not.toHaveBeenCalled()
    expect(control).toHaveBeenCalledOnce()
  })

  describe('a node of a class the API did not register', () => {
    it('hears no hook, by name or by class, from a class a legacy pack registered over the type', () => {
      const onCreated = vi.fn()
      const onRemoved = vi.fn()
      extend((builder) => {
        builder.onCreated(onCreated)
        builder.onRemoved(onRemoved)
        builder.addMenuItem({ label: 'Pack entry', run: () => {} })
      })
      class LegacyNode extends LGraphNode {}
      LiteGraph.registerNodeType(TYPE, LegacyNode)

      const node = addedNode()
      const menu = host.nodeTypeHooks.getNodeMenuItems(node)
      graph.remove(node)

      expect(node).toBeInstanceOf(LegacyNode)
      expect([
        onCreated.mock.calls.length,
        onRemoved.mock.calls.length
      ]).toEqual([0, 0])
      expect(menu).toEqual([])
    })

    it('hears every hook from a class that extends the one it registered', () => {
      const onCreated = vi.fn()
      const onRemoved = vi.fn()
      extend((builder) => {
        builder.onCreated(onCreated)
        builder.onRemoved(onRemoved)
      })
      const Registered = LiteGraph.registered_node_types[TYPE]
      LiteGraph.registerNodeType(TYPE, class extends Registered {})

      graph.remove(addedNode())

      expect([
        onCreated.mock.calls.length,
        onRemoved.mock.calls.length
      ]).toEqual([1, 1])
    })

    it('keeps one API instance from hearing the nodes of a type another registered', () => {
      const onCreated = vi.fn()
      const onRemoved = vi.fn()
      extend((builder) => {
        builder.onCreated(onCreated)
        builder.onRemoved(onRemoved)
      })
      const other = createComfyApi({ getGraph: () => graph })
      registerHostType(other.host.nodeTypeHooks, hostNodeDef(TYPE))

      graph.remove(addedNode())

      expect([
        onCreated.mock.calls.length,
        onRemoved.mock.calls.length
      ]).toEqual([0, 0])
    })
  })

  describe('saved state', () => {
    it('copies saved state only when a hook asks for it', () => {
      const node = addedNode()
      const saved = node.serialize()
      const stringify = vi.spyOn(JSON, 'stringify')
      const copiesWhileConfiguring = () => {
        stringify.mockClear()
        node.configure(saved)
        return stringify.mock.calls.length
      }
      const withoutHooks = copiesWhileConfiguring()

      extend((builder) => builder.onCreated(() => {}))
      const withCreatedOnly = copiesWhileConfiguring()
      extend((builder) => builder.onConfigured(() => {}))
      const withConfigured = copiesWhileConfiguring()

      expect(withCreatedOnly).toBe(withoutHooks)
      expect(withConfigured).toBeGreaterThan(withoutHooks)
    })
  })

  describe('menus', () => {
    it('reports an entry whose label fails only the first time the menu opens', () => {
      const broken = new Error('label failed')
      extend((builder) =>
        builder.addMenuItem({
          label: () => {
            throw broken
          },
          run: () => {}
        })
      )
      const node = addedNode()

      host.nodeTypeHooks.getNodeMenuItems(node)
      host.nodeTypeHooks.getNodeMenuItems(node)

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        broken,
        expect.objectContaining({ tags: { event: 'addMenuItem' } })
      )
    })
  })
})
