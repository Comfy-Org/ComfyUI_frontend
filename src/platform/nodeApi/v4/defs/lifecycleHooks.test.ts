import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  Comfy,
  DefRegistry,
  NodeCreatedEvent,
  NodeDefBuilder,
  NodeHandle
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

vi.mock(import('@/lib/litegraph/src/graphIntents'), { spy: true })

const TYPE = 'Pack/Probe'

describe('node lifecycle hooks', () => {
  let graph: LGraph
  let comfy: Comfy
  let defs: DefRegistry
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
    defs = comfy.defs
    registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return defs.extend(TYPE, apply)
  }

  function created(): LGraphNode {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
    return node
  }

  function added(target: LGraph = graph): LGraphNode {
    const node = created()
    target.add(node)
    return node
  }

  function nodeMethod(node: LGraphNode, name: 'onExecuted') {
    const method = node[name]
    assert(method)
    return method
  }

  describe('onCreated', () => {
    it('hears a node join a graph, with its handle', () => {
      const calls: [NodeHandle, NodeCreatedEvent][] = []
      extend((builder) =>
        builder.onCreated((node, event) => calls.push([node, event]))
      )

      const node = added()

      expect(calls).toHaveLength(1)
      const [[handle, event]] = calls
      expect(handle).toBe(comfy.graph.node(String(node.id)))
      expect(event).toEqual({ restored: false, loading: false })
      expect(Object.isFrozen(event)).toBe(true)
    })

    it('waits until a node joins a graph', () => {
      const onCreated = vi.fn()
      extend((builder) => builder.onCreated(onCreated))

      const node = created()

      expect(onCreated).not.toHaveBeenCalled()

      graph.add(node)

      expect(onCreated).toHaveBeenCalledOnce()
    })

    it('says a node a pack configures before it joins was restored', () => {
      const order: string[] = []
      extend((builder) => {
        builder.onCreated((_, event) => order.push(`created ${event.restored}`))
        builder.onConfigured((_, data) =>
          order.push(`configured ${data.title}`)
        )
      })
      const node = created()

      node.configure({ ...node.serialize(), title: 'Configured first' })
      graph.add(node)

      expect(order).toEqual(['created true', 'configured Configured first'])
    })

    it('says a node configured before it joins was restored even with no hook for saved state', () => {
      const events: NodeCreatedEvent[] = []
      extend((builder) => builder.onCreated((_, event) => events.push(event)))
      const node = created()

      node.configure(node.serialize())
      graph.add(node)

      expect(events).toEqual([{ restored: true, loading: false }])
    })

    it('forgets saved state once delivered, so a node added again is not restored', () => {
      const events: NodeCreatedEvent[] = []
      const onConfigured = vi.fn()
      extend((builder) => {
        builder.onCreated((_, event) => events.push(event))
        builder.onConfigured(onConfigured)
      })
      const node = created()
      node.configure(node.serialize())
      graph.add(node)
      graph.remove(node)

      graph.add(node)

      expect(events.map((event) => event.restored)).toEqual([true, false])
      expect(onConfigured).toHaveBeenCalledOnce()
    })

    it('hears nothing from a node that names a graph it is not in', () => {
      const onRemoved = vi.fn()
      extend((builder) => builder.onRemoved(onRemoved))
      const inGraph = added()
      const stray = created()
      stray.id = inGraph.id
      Reflect.set(stray, 'graph', graph)

      stray.onRemoved?.()

      expect(onRemoved).not.toHaveBeenCalled()

      inGraph.onRemoved?.()

      expect(onRemoved).toHaveBeenCalledOnce()
    })

    it('says a node added while a workflow loads is loading and restored', () => {
      const onCreated = vi.fn()
      extend((builder) => builder.onCreated(onCreated))

      withGraphIntentSource('load', () => graph.add(created()))

      expect(onCreated).toHaveBeenCalledWith(expect.anything(), {
        restored: true,
        loading: true
      })
    })

    it('hears the nodes of a saved graph load, then their saved state', () => {
      const saved = new LGraph()
      const original = created()
      original.title = 'Saved'
      saved.add(original)
      const order: string[] = []
      extend((builder) => {
        builder.onCreated((node, event) =>
          order.push(`created ${event.loading} ${node.getTitle()}`)
        )
        builder.onConfigured((_, data) =>
          order.push(`configured ${data.title}`)
        )
      })

      graph.configure(saved.serialize())

      expect(order).toEqual(['created true Saved', 'configured Saved'])
    })

    it('gives a node in a subgraph a handle in its own graph', () => {
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const handles: NodeHandle[] = []
      extend((builder) => builder.onCreated((node) => handles.push(node)))

      added(subgraph)

      expect(handles.map((handle) => handle.graphId)).toEqual([subgraph.id])
      expect(handles[0].isDeleted).toBe(false)
    })
  })

  describe('onConfigured', () => {
    it('hears saved state a node in a graph takes, as a frozen copy', () => {
      const received: Readonly<Record<string, unknown>>[] = []
      extend((builder) =>
        builder.onConfigured((_, data) => received.push(data))
      )
      const node = added()
      const data = { ...node.serialize(), title: 'Configured' }

      node.configure(data)

      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({ title: 'Configured' })
      expect(received[0]).not.toBe(data)
      expect(Object.isFrozen(received[0])).toBe(true)
    })

    it('holds the saved state of a node configured before it joined until it joins', () => {
      const onConfigured = vi.fn()
      extend((builder) => builder.onConfigured(onConfigured))
      const node = created()

      node.configure(node.serialize())

      expect(onConfigured).not.toHaveBeenCalled()

      graph.add(node)

      expect(onConfigured).toHaveBeenCalledOnce()
    })
  })

  describe('saved state a workflow cannot save', () => {
    it('gives empty data for saved state it cannot copy, and reports it', () => {
      const received: unknown[] = []
      extend((builder) =>
        builder.onConfigured((_, data) => received.push(data))
      )
      const node = added()

      const saved = node.serialize()
      Reflect.set(saved, 'properties', { big: 10n })

      node.configure(saved)

      expect(received).toEqual([{}])
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('gives an empty result for output it cannot copy', () => {
      const results: unknown[] = []
      extend((builder) =>
        builder.onExecuted((_, result) => results.push(result))
      )
      const node = added()

      Reflect.apply(nodeMethod(node, 'onExecuted'), node, [{ text: [1n] }])

      expect(results).toEqual([{ text: [], images: [], raw: {} }])
    })

    it('saves nothing from fields it cannot copy', () => {
      extend((builder) => builder.onSerialize(() => ({ big: 10n })))
      const node = added()

      expect(node.serialize()).not.toHaveProperty('big')
      expect(reportError).toHaveBeenCalledOnce()
    })
  })

  describe('onRemoved', () => {
    it('hears a node leave while its handle still reads it', () => {
      const titles: (string | undefined)[] = []
      let kept: NodeHandle | undefined
      extend((builder) =>
        builder.onRemoved((node) => {
          kept = node
          titles.push(node.getTitle())
        })
      )
      const node = added()
      node.title = 'Leaving'

      graph.remove(node)

      expect(titles).toEqual(['Leaving'])
      expect(kept?.isDeleted).toBe(true)
    })

    it('keeps what the type itself does when a node leaves', () => {
      const own = vi.fn()
      class WithOwnRemoval extends LGraphNode {
        override onRemoved() {
          own()
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(
        WithOwnRemoval,
        hostNodeDef('Own')
      )
      LiteGraph.registerNodeType('Own', WithOwnRemoval)
      const onRemoved = vi.fn()
      defs.extend('Own', (builder) => builder.onRemoved(onRemoved))
      const node = LiteGraph.createNode('Own')
      assert(node)
      graph.add(node)

      graph.remove(node)

      expect(own).toHaveBeenCalledOnce()
      expect(onRemoved).toHaveBeenCalledOnce()
    })
  })

  describe('onExecuted', () => {
    it('gives the texts, images and a frozen copy of what the server sent', () => {
      const results: unknown[] = []
      extend((builder) =>
        builder.onExecuted((_, result) => results.push(result))
      )
      const node = added()
      const output = {
        text: ['done', 3],
        images: [{ filename: 'a.png' }, 'not an image'],
        custom: { nested: true }
      }

      Reflect.apply(nodeMethod(node, 'onExecuted'), node, [output])

      expect(results).toEqual([
        {
          text: ['done'],
          images: [{ filename: 'a.png' }],
          raw: output
        }
      ])
      const [result] = results
      expect(Object.isFrozen(result)).toBe(true)
      expect(Reflect.get(Object(result), 'raw')).not.toBe(output)
    })

    it('gives empty lists for output without texts or images', () => {
      const results: unknown[] = []
      extend((builder) =>
        builder.onExecuted((_, result) => results.push(result))
      )
      const node = added()

      Reflect.apply(nodeMethod(node, 'onExecuted'), node, [
        { text: 'one string', images: undefined }
      ])

      expect(results).toEqual([
        { text: [], images: [], raw: { text: 'one string' } }
      ])
    })
  })

  describe('onSerialize', () => {
    it('saves the fields a pack returns, and hands them back when the node loads', () => {
      const received: unknown[] = []
      extend((builder) => {
        builder.onSerialize(() => ({ packState: { level: 2 } }))
        builder.onConfigured((_, data) => received.push(data.packState))
      })
      const node = added()

      const saved = node.serialize()
      graph.remove(node)
      const restored = created()
      graph.add(restored)
      restored.configure(saved)

      expect(Reflect.get(saved, 'packState')).toEqual({ level: 2 })
      expect(received).toEqual([{ level: 2 }])
    })

    it.for([
      {
        name: 'a field the node saves itself',
        fields: { title: 'x', mine: 1 }
      },
      { name: 'the extension store', fields: { extensions: {} } },
      { name: 'a value that is not an object', fields: 'mine' }
    ])(
      'refuses $name, saves none of the result, and reports it',
      ({ fields }) => {
        extend((builder) => {
          builder.onSerialize(() => Reflect.apply(Object, null, [fields]))
          builder.onSerialize(() => ({ kept: true }))
        })
        const node = added()

        const saved = node.serialize()

        expect(saved.title).not.toBe('x')
        expect(Reflect.get(saved, 'mine')).toBeUndefined()
        expect(Reflect.get(saved, 'kept')).toBe(true)
        expect(reportError).toHaveBeenCalledWith(
          expect.any(TypeError),
          expect.objectContaining({ tags: { event: 'onSerialize' } })
        )
      }
    )

    it('saves nothing for a pack that returns nothing', () => {
      extend((builder) => builder.onSerialize(() => undefined))
      const node = added()

      expect(node.serialize()).not.toHaveProperty('extensions')
      expect(reportError).not.toHaveBeenCalled()
    })
  })

  describe('onResized', () => {
    it('hears the new size of a node in a graph, and not of one outside', () => {
      const sizes: unknown[] = []
      extend((builder) => builder.onResized((_, size) => sizes.push(size)))
      const node = created()

      node.setSize([120, 80])

      expect(sizes).toEqual([])

      graph.add(node)
      node.setSize([140, 90])

      expect(sizes).toEqual([{ width: 140, height: 90 }])
      expect(Object.isFrozen(sizes[0])).toBe(true)
    })
  })

  describe('registrations', () => {
    it('stops a hook when its extension is unsubscribed, and keeps the others', () => {
      const stopped = vi.fn()
      const kept = vi.fn()
      const stop = extend((builder) => builder.onCreated(stopped))
      extend((builder) => builder.onCreated(kept))

      stop()
      stop()
      added()

      expect(stopped).not.toHaveBeenCalled()
      expect(kept).toHaveBeenCalledOnce()
    })

    it('runs hooks in the order the extensions were made', () => {
      const order: string[] = []
      extend((builder) => builder.onCreated(() => order.push('first')))
      extend((builder) => {
        builder.onCreated(() => order.push('second'))
        builder.onCreated(() => order.push('third'))
      })

      added()

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('reports a hook that throws and still runs the others', () => {
      const broken = new Error('hook failed')
      const after = vi.fn()
      extend((builder) =>
        builder.onRemoved(() => {
          throw broken
        })
      )
      extend((builder) => builder.onRemoved(after))
      const node = added()

      graph.remove(node)

      expect(after).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'onRemoved' } })
      )
    })

    it('keeps none of the hooks of an apply that throws', () => {
      const onCreated = vi.fn()
      extend((builder) => {
        builder.onCreated(onCreated)
        throw new Error('apply failed')
      })

      added()

      expect(onCreated).not.toHaveBeenCalled()
    })

    it('refuses a hook that is not a function', () => {
      let refusal: unknown
      extend((builder) => {
        try {
          Reflect.apply(builder.onCreated, builder, ['not a function'])
        } catch (error) {
          refusal = error
        }
      })

      expect(refusal).toBeInstanceOf(TypeError)
    })

    it('refuses a hook added after the extend callback returned', () => {
      let kept: NodeDefBuilder | undefined
      extend((builder) => {
        kept = builder
      })
      const onCreated = vi.fn()

      expect(() => kept?.onCreated(onCreated)).toThrow(
        /^onCreated can only be called/
      )
      added()

      expect(onCreated).not.toHaveBeenCalled()
    })

    it('puts one dispatcher on a type however often packs extend and unsubscribe', () => {
      const nodeClass = LiteGraph.registered_node_types[TYPE]
      extend((builder) => builder.onRemoved(() => {}))()
      const installed = nodeClass.prototype.onRemoved

      for (let cycle = 0; cycle < 100; cycle++) {
        extend((builder) => builder.onRemoved(() => {}))()
      }
      const onRemoved = vi.fn()
      extend((builder) => builder.onRemoved(onRemoved))
      graph.remove(added())

      expect(nodeClass.prototype.onRemoved).toBe(installed)
      expect(onRemoved).toHaveBeenCalledOnce()
    })

    it('reaches the nodes of a type the host registers again, once each', () => {
      const onCreated = vi.fn()
      extend((builder) => builder.onCreated(onCreated))

      registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
      added()

      expect(onCreated).toHaveBeenCalledOnce()
    })

    it('listens for nodes joining only while a hook needs it', () => {
      const listeners = new Set<unknown>()
      vi.mocked(onGraphIntent).mockImplementation((listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      })
      const listening = () => listeners.size

      expect(listening()).toBe(0)

      const stopCreated = extend((builder) => builder.onCreated(() => {}))
      const stopConfigured = extend((builder) => builder.onConfigured(() => {}))

      expect(listening()).toBe(1)

      stopCreated()

      expect(listening()).toBe(1)

      stopConfigured()

      expect(listening()).toBe(0)
    })
  })

  describe('a defined type', () => {
    it('runs the hooks its definition declares', () => {
      const onCreated = vi.fn()
      const onRemoved = vi.fn()
      defs.define({ type: 'Defined', onCreated, onRemoved })
      const node = LiteGraph.createNode('Defined')
      assert(node)

      graph.add(node)
      graph.remove(node)

      expect(onCreated).toHaveBeenCalledOnce()
      expect(onRemoved).toHaveBeenCalledOnce()
    })

    it('runs the saving and loading hooks its definition declares', () => {
      const onConfigured = vi.fn()
      defs.define({
        type: 'Defined',
        onSerialize: () => ({ packState: 1 }),
        onConfigured
      })
      const node = LiteGraph.createNode('Defined')
      assert(node)
      graph.add(node)

      node.configure(node.serialize())

      expect(onConfigured).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ packState: 1 })
      )
    })

    it('stops its hooks when unsubscribed', () => {
      const onCreated = vi.fn()
      const stop = defs.define({ type: 'Defined', onCreated })
      const node = LiteGraph.createNode('Defined')
      assert(node)

      stop()
      graph.add(node)

      expect(onCreated).not.toHaveBeenCalled()
    })

    it('stops the hooks of a definition replaced by a later one of the same type', () => {
      const first = vi.fn()
      const second = vi.fn()
      defs.define({ type: 'Defined', onCreated: first })()
      defs.define({ type: 'Defined', onCreated: second })
      const node = LiteGraph.createNode('Defined')
      assert(node)

      graph.add(node)

      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledOnce()
    })

    it('runs its hooks only for its own type', () => {
      const onCreated = vi.fn()
      defs.define({ type: 'Defined', onCreated })
      registerHostType(host.nodeTypeHooks, hostNodeDef('Other'))

      graph.add(created())
      const other = LiteGraph.createNode('Other')
      assert(other)
      graph.add(other)

      expect(onCreated).not.toHaveBeenCalled()
    })

    it('refuses a hook that is not a function', () => {
      expect(() =>
        Reflect.apply(defs.define, defs, [{ type: 'Defined', onCreated: 5 }])
      ).toThrow(new TypeError('define needs onCreated as a function, not 5.'))
      expect(() =>
        Reflect.apply(defs.define, defs, [{ type: 'Defined', resolve: 5 }])
      ).toThrow(new TypeError('define needs resolve as a function, not 5.'))
      expect(defs.has('Defined')).toBe(false)
    })
  })
})
