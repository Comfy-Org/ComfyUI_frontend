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

    it('gives a class registered under another type name no hook of the type it extends', () => {
      const onCreated = vi.fn()
      const onRemoved = vi.fn()
      extend((builder) => {
        builder.onCreated(onCreated)
        builder.onRemoved(onRemoved)
      })
      const Registered = LiteGraph.registered_node_types[TYPE]
      LiteGraph.registerNodeType('Pack/Clone', class extends Registered {})

      graph.remove(addedNode('Pack/Clone'))
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

  describe('a callback that returns a rejected promise', () => {
    it('is reported as a hook, a menu entry and a reload listener that throw are', async () => {
      const failure = (where: string) => async () => {
        await Promise.resolve()
        throw new Error(where)
      }
      extend((builder) => {
        builder.onCreated(failure('hook'))
        builder.addMenuItem({ label: 'Async', run: failure('menu') })
      })
      defs.onRefreshed(failure('refresh'))
      const node = addedNode()
      const [entry] = host.nodeTypeHooks.getNodeMenuItems(node)
      assert(entry.callback)
      void Reflect.apply(entry.callback, null, [])
      host.nodeTypeHooks.refreshComboInNodes()

      await vi.waitFor(() =>
        expect(
          vi
            .mocked(reportError)
            .mock.calls.map(([error, context]) => [String(error), context.tags])
        ).toEqual([
          ['Error: hook', { event: 'onCreated' }],
          ['Error: menu', { event: 'addMenuItem' }],
          ['Error: refresh', { event: 'onRefreshed' }]
        ])
      )
    })
  })

  it('copies an output or a property value only when a hook will receive it', () => {
    const stop = extend((builder) => {
      builder.onExecuted(() => {})
      builder.onPropertyChanged(() => {})
    })
    const node = addedNode()
    const stringify = vi.spyOn(JSON, 'stringify')
    node.onExecuted?.({ text: ['kept'] })
    node.setProperty('size', 1)
    const withHooks = stringify.mock.calls.length
    stringify.mockClear()
    stop()

    node.onExecuted?.({ text: ['kept'] })
    node.setProperty('size', 2)

    expect(withHooks).toBeGreaterThan(0)
    expect(stringify).not.toHaveBeenCalled()
    stringify.mockRestore()
  })

  it('copies an output once however many hooks receive it', () => {
    extend((builder) => builder.onExecuted(() => {}))
    extend((builder) => builder.onExecuted(() => {}))
    const node = addedNode()
    const stringify = vi.spyOn(JSON, 'stringify')

    node.onExecuted?.({ text: ['kept'] })
    const copies = stringify.mock.calls.length
    stringify.mockRestore()

    expect(copies).toBe(1)
  })

  it('calls a hook added during a delivery only from the next event, and each hook once', () => {
    const added = vi.fn()
    const first = vi.fn(() => {
      extend((builder) => builder.onRemoved(added))
    })
    const last = vi.fn()
    extend((builder) => builder.onRemoved(first))
    extend((builder) => builder.onRemoved(last))

    graph.remove(addedNode())

    expect([first.mock.calls.length, last.mock.calls.length]).toEqual([1, 1])
    expect(added).not.toHaveBeenCalled()
    graph.remove(addedNode())
    expect(added).toHaveBeenCalledOnce()
  })
})
