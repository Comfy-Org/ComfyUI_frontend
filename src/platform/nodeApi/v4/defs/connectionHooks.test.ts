import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  BeforeConnectEvent,
  ConnectionChangeEvent,
  DefRegistry,
  NodeDefBuilder,
  PropertyChangeEvent
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

const TYPE = 'Pack/Probe'

describe('connection, property and pointer hooks', () => {
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

  function probe(slots: { inputs?: string[]; outputs?: string[] } = {}) {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
    for (const name of slots.inputs ?? []) node.addInput(name, '*')
    for (const name of slots.outputs ?? []) node.addOutput(name, '*')
    graph.add(node)
    return node
  }

  function source() {
    const node = new LGraphNode('Source')
    node.addOutput('out', '*')
    graph.add(node)
    return node
  }

  describe('onConnectionsChanged', () => {
    function heard() {
      const events: ConnectionChangeEvent[] = []
      extend((builder) =>
        builder.onConnectionsChanged((_, event) => events.push(event))
      )
      return events
    }

    it('names the input that was connected and the node at the other end', () => {
      const events = heard()
      const target = probe({ inputs: ['a', 'b'] })
      const from = source()

      from.connect(0, target, 1)

      expect(events).toEqual([
        {
          side: 'input',
          index: 1,
          name: 'b',
          connected: true,
          peerNodeId: String(from.id),
          peerIndex: 0
        }
      ])
      expect(Object.isFrozen(events[0])).toBe(true)
    })

    it('names the output that was connected and the node it feeds', () => {
      const events = heard()
      const from = probe({ outputs: ['first', 'second'] })
      const target = new LGraphNode('Target')
      target.addInput('in', '*')
      graph.add(target)

      from.connect(1, target, 0)

      expect(events).toEqual([
        {
          side: 'output',
          index: 1,
          name: 'second',
          connected: true,
          peerNodeId: String(target.id),
          peerIndex: 0
        }
      ])
    })

    it('names no other end when the host reports a change without a link', () => {
      const events = heard()
      const node = probe({ inputs: ['a'] })

      node.onConnectionsChange?.(
        NodeSlotType.INPUT,
        0,
        false,
        null,
        node.inputs[0]
      )

      expect(events).toEqual([
        expect.objectContaining({
          name: 'a',
          peerNodeId: undefined,
          peerIndex: undefined
        })
      ])
    })

    it.for([
      { name: 'a middle input', removed: 1, expected: 'b' },
      { name: 'the last input', removed: 2, expected: 'c' }
    ])(
      'names $name that was removed with its link, not the slot that took its place',
      ({ removed, expected }) => {
        const events = heard()
        const target = probe({ inputs: ['a', 'b', 'c'] })
        source().connect(0, target, removed)
        events.length = 0

        target.removeInput(removed)

        expect(events).toEqual([
          expect.objectContaining({
            side: 'input',
            index: removed,
            name: expected,
            connected: false
          })
        ])
      }
    )
  })

  describe('onBeforeConnect', () => {
    it('refuses a link when a hook returns false, and says which slot', () => {
      const events: BeforeConnectEvent[] = []
      extend((builder) =>
        builder.onBeforeConnect((_, event) => {
          events.push(event)
          return false
        })
      )
      const target = probe({ inputs: ['a', 'b'] })

      const link = source().connect(0, target, 1)

      expect(link).toBeNull()
      expect(events).toEqual([{ side: 'input', index: 1 }])
    })

    it('asks about the output side too', () => {
      const events: BeforeConnectEvent[] = []
      extend((builder) =>
        builder.onBeforeConnect((_, event) => {
          events.push(event)
        })
      )
      const from = probe({ outputs: ['out'] })
      const target = new LGraphNode('Target')
      target.addInput('in', '*')
      graph.add(target)

      const link = from.connect(0, target, 0)

      expect(link).not.toBeNull()
      expect(events).toEqual([{ side: 'output', index: 0 }])
    })

    it('lets a link through when no hook refuses it, even one that throws', () => {
      extend((builder) => {
        builder.onBeforeConnect(() => true)
        builder.onBeforeConnect(() => {
          throw new Error('hook failed')
        })
      })
      const target = probe({ inputs: ['a'] })

      expect(source().connect(0, target, 0)).not.toBeNull()
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('keeps a refusal of an output link the type itself makes', () => {
      class Refusing extends LGraphNode {
        override onConnectOutput() {
          return false
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(Refusing, hostNodeDef('NoOut'))
      LiteGraph.registerNodeType('NoOut', Refusing)
      const allow = vi.fn(() => true)
      defs.extend('NoOut', (builder) => builder.onBeforeConnect(allow))
      const from = LiteGraph.createNode('NoOut')
      assert(from)
      from.addOutput('out', '*')
      graph.add(from)
      const target = probe({ inputs: ['a'] })

      expect(from.connect(0, target, 0)).toBeNull()
      expect(allow).not.toHaveBeenCalled()
    })

    it('keeps a refusal the type itself makes', () => {
      class Refusing extends LGraphNode {
        override onConnectInput() {
          return false
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(
        Refusing,
        hostNodeDef('Refusing')
      )
      LiteGraph.registerNodeType('Refusing', Refusing)
      const allow = vi.fn(() => true)
      defs.extend('Refusing', (builder) => builder.onBeforeConnect(allow))
      const target = LiteGraph.createNode('Refusing')
      assert(target)
      target.addInput('a', '*')
      graph.add(target)

      expect(source().connect(0, target, 0)).toBeNull()
      expect(allow).not.toHaveBeenCalled()
    })
  })

  describe('onPropertyChanged', () => {
    function changes(respond: (event: PropertyChangeEvent) => void = () => {}) {
      const events: PropertyChangeEvent[] = []
      extend((builder) =>
        builder.onPropertyChanged((_, event) => {
          events.push(event)
          respond(event)
        })
      )
      return events
    }

    it('hears a property set, with a frozen copy of the value', () => {
      const events = changes()
      const node = probe()
      const value = { nested: [1] }

      node.setProperty('shape', value)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ name: 'shape', value })
      expect(events[0].value).not.toBe(value)
      expect(Object.isFrozen(events[0].value)).toBe(true)
    })

    it('stores the value a hook gives instead', () => {
      changes((event) => event.setValue(Math.min(Number(event.value), 10)))
      const node = probe()

      node.setProperty('max', 50)

      expect(node.properties.max).toBe(10)
    })

    it('keeps the earlier value when a hook rejects the change', () => {
      changes((event) => event.reject())
      const node = probe()
      node.properties.max = 5

      node.setProperty('max', 50)

      expect(node.properties.max).toBe(5)
    })

    it('keeps a value restored from a saved workflow that a hook rejects', () => {
      changes((event) => event.reject())
      const node = probe()

      node.configure({ ...node.serialize(), properties: { max: 50 } })

      expect(node.properties.max).toBe(50)
    })

    it('lets the last pack that answers win', () => {
      changes((event) => event.reject())
      changes((event) => event.setValue(7))
      const node = probe()

      node.setProperty('max', 50)

      expect(node.properties.max).toBe(7)
    })

    it('refuses a replacement a workflow cannot save, and keeps the value set', () => {
      let refusal: unknown
      changes((event) => {
        try {
          event.setValue(10n)
        } catch (error) {
          refusal = error
        }
      })
      const node = probe()

      node.setProperty('max', 50)

      expect(refusal).toBeInstanceOf(TypeError)
      expect(node.properties.max).toBe(50)
    })

    it('refuses an unset replacement, quietly, and keeps the value set', () => {
      let refusal: unknown
      changes((event) => {
        try {
          event.setValue(undefined)
        } catch (error) {
          refusal = error
        }
      })
      const node = probe()

      node.setProperty('max', 50)

      expect(refusal).toBeInstanceOf(TypeError)
      expect(node.properties.max).toBe(50)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('refuses to settle a change once the hook that received it has returned', () => {
      let kept: PropertyChangeEvent | undefined
      changes((event) => {
        kept = event
      })
      const node = probe()
      node.setProperty('max', 50)
      assert(kept)
      const event = kept

      expect(() => event.setValue(1)).toThrow(/^setValue can only be called/)
      expect(() => event.reject()).toThrow(/^reject can only be called/)
      expect(node.properties.max).toBe(50)
    })

    it('copies the new value once however many hooks read it', () => {
      const values: unknown[] = []
      changes((event) => values.push(event.value))
      changes((event) => values.push(event.value, event.value))
      changes(() => {})
      const node = probe()
      const stringify = vi.spyOn(JSON, 'stringify')

      node.setProperty('max', { deep: 1 })
      const copies = stringify.mock.calls.length
      stringify.mockClear()
      stringify.mockRestore()

      expect(copies).toBe(1)
      expect(new Set(values).size).toBe(1)
      expect(values).toHaveLength(3)
    })

    it('keeps a refusal the type itself makes, without telling the hooks', () => {
      class Refusing extends LGraphNode {
        override onPropertyChanged() {
          return false
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(Refusing, hostNodeDef('Fixed'))
      LiteGraph.registerNodeType('Fixed', Refusing)
      const onPropertyChanged = vi.fn()
      defs.extend('Fixed', (builder) =>
        builder.onPropertyChanged(onPropertyChanged)
      )
      const node = LiteGraph.createNode('Fixed')
      assert(node)
      graph.add(node)
      node.properties.max = 5

      node.setProperty('max', 50)

      expect(node.properties.max).toBe(5)
      expect(onPropertyChanged).not.toHaveBeenCalled()
    })

    it('hears a node only once it is in a graph', () => {
      const events = changes()
      const node = LiteGraph.createNode(TYPE)
      assert(node)

      node.setProperty('max', 1)

      expect(events).toEqual([])

      graph.add(node)
      node.setProperty('max', 2)

      expect(events.map((event) => event.value)).toEqual([2])
    })
  })

  describe('pointer hooks', () => {
    const pointer = fromPartial<CanvasPointerEvent>({})

    it('hears the pointer enter and leave a node', () => {
      const hovering: boolean[] = []
      extend((builder) => builder.onHover((_, isOver) => hovering.push(isOver)))
      const node = probe()

      node.onMouseEnter?.(pointer)
      node.onMouseLeave?.(pointer)

      expect(hovering).toEqual([true, false])
    })

    it('hears a double click', () => {
      const onDoubleClick = vi.fn()
      extend((builder) => builder.onDoubleClick(onDoubleClick))
      const node = probe()

      node.onDblClick?.(pointer, [0, 0], fromPartial<LGraphCanvas>({}))

      expect(onDoubleClick).toHaveBeenCalledOnce()
    })
  })

  describe('a defined type', () => {
    it('runs the connection and property hooks its definition declares', () => {
      const onConnectionsChanged = vi.fn()
      const onPropertyChanged = vi.fn()
      defs.define({
        type: 'Defined',
        inputs: [{ name: 'in', type: '*' }],
        onConnectionsChanged,
        onPropertyChanged
      })
      const node = LiteGraph.createNode('Defined')
      assert(node)
      graph.add(node)

      source().connect(0, node, 0)
      node.setProperty('max', 1)

      expect(onConnectionsChanged).toHaveBeenCalledOnce()
      expect(onPropertyChanged).toHaveBeenCalledOnce()
    })
  })
})
