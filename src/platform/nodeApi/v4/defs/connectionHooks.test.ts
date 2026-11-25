import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  BeforeConnectEvent,
  Comfy,
  ConnectionChangeEvent,
  DefRegistry,
  NodeDefBuilder,
  PackId,
  PropertyChangeEvent
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

const TYPE = 'Pack/Probe'

describe('connection, property and pointer hooks', () => {
  let graph: LGraph
  let defs: DefRegistry
  let comfy: Comfy
  let host: ComfyApiHost

  let packId: PackId

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    packId = registerTestPack(api)
    comfy = api.comfy
    defs = comfy.defs
    host = api.host
    registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    const stop = defs.extend(packId, TYPE, apply)
    onTestFinished(stop)
    return stop
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

    describe('when a hook moves an end of the link it was asked about', () => {
      function linkedInputs(node: LGraphNode) {
        return node.inputs.map(({ name, link }) => [name, link !== null])
      }

      it('refuses a link to an input a hook removed, rather than landing it on the slot that moved up', () => {
        extend((builder) =>
          builder.onBeforeConnect((node) => {
            node.inputs.remove('a')
          })
        )
        const target = probe({ inputs: ['a', 'b'] })

        const link = source().connect(0, target, 0)

        expect(link).toBeNull()
        expect(linkedInputs(target)).toEqual([['b', false]])
        expect(graph.links.size).toBe(0)
      })

      it('refuses a link from a node a hook removed', () => {
        const from = source()
        extend((builder) =>
          builder.onBeforeConnect(() => {
            comfy.graph.node(String(from.id))?.remove()
          })
        )
        const target = probe({ inputs: ['a'] })

        expect(from.connect(0, target, 0)).toBeNull()
        expect(linkedInputs(target)).toEqual([['a', false]])
        expect(graph.links.size).toBe(0)
      })

      it('refuses a link to an input a hook on the output side removed', () => {
        const target = new LGraphNode('Target')
        target.addInput('a', '*')
        target.addInput('b', '*')
        graph.add(target)
        extend((builder) =>
          builder.onBeforeConnect(() => {
            comfy.graph.node(String(target.id))?.inputs.remove('a')
          })
        )
        const from = probe({ outputs: ['out'] })

        expect(from.connect(0, target, 0)).toBeNull()
        expect(linkedInputs(target)).toEqual([['b', false]])
      })

      it('lets the link through when the hook leaves both ends in place', () => {
        extend((builder) =>
          builder.onBeforeConnect((node) => {
            node.setTitle('Asked')
          })
        )
        const target = probe({ inputs: ['a', 'b'] })

        expect(source().connect(0, target, 0)).not.toBeNull()
        expect(linkedInputs(target)).toEqual([
          ['a', true],
          ['b', false]
        ])
      })
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
      onTestFinished(
        defs.extend(packId, 'NoOut', (builder) =>
          builder.onBeforeConnect(allow)
        )
      )
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
      onTestFinished(
        defs.extend(packId, 'Refusing', (builder) =>
          builder.onBeforeConnect(allow)
        )
      )
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

    it('hears a property deleted through the API, with no value', () => {
      const events = changes()
      const node = probe()
      node.properties.max = 5
      const handle = comfy.graph.node(String(node.id))
      assert(handle)

      expect(handle.setProperty('max', undefined)).toBe(true)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ name: 'max', value: undefined })
      expect(Object.hasOwn(node.properties, 'max')).toBe(false)
    })

    it('keeps the earlier value of a property a hook will not let the API delete', () => {
      changes((event) => event.reject())
      const node = probe()
      node.properties.max = 5
      const handle = comfy.graph.node(String(node.id))
      assert(handle)

      expect(handle.setProperty('max', undefined)).toBe(false)

      expect(node.properties.max).toBe(5)
    })

    it('keeps the value a hook gives instead of a deletion', () => {
      changes((event) => event.setValue(1))
      const node = probe()
      node.properties.max = 5
      const handle = comfy.graph.node(String(node.id))
      assert(handle)

      expect(handle.setProperty('max', undefined)).toBe(false)

      expect(node.properties.max).toBe(1)
    })

    it('keeps a value restored from a saved workflow that a hook rejects', () => {
      changes((event) => event.reject())
      const node = probe()

      node.configure({ ...node.serialize(), properties: { max: 50 } })

      expect(node.properties.max).toBe(50)
    })

    it('keeps a value a workflow load restores when a hook gives another, so the next save writes the saved one', () => {
      const restored: unknown[] = []
      changes((event) => {
        restored.push(event.value)
        event.setValue(Math.min(Number(event.value), 10))
      })
      probe().properties.level = 99
      const saved = graph.serialize()
      const loaded = new LGraph()

      loaded.configure(saved)

      expect(restored).toContain(99)
      expect(loaded.serialize().nodes[0].properties).toMatchObject({
        level: 99
      })
    })

    it('stores the value a hook gives for a property a pack sets while the node loads', () => {
      changes((event) => event.setValue(Math.min(Number(event.value), 10)))
      extend((builder) =>
        builder.onConfigured((handle) => handle.setProperty('level', 50))
      )
      const node = probe()

      node.configure({ ...node.serialize(), properties: { other: 1 } })

      expect(node.properties.level).toBe(10)
    })

    it('still stores the value a hook gives for a property set after a load', () => {
      changes((event) => event.setValue(Math.min(Number(event.value), 10)))
      const node = probe()
      node.configure({ ...node.serialize(), properties: { level: 99 } })

      node.setProperty('level', 50)

      expect(node.properties.level).toBe(10)
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

    it('gives every hook one frozen copy of the new value, apart from the value set', () => {
      const values: unknown[] = []
      changes((event) => values.push(event.value))
      changes((event) => values.push(event.value, event.value))
      const node = probe()
      const given = { deep: { level: 1 } }

      node.setProperty('max', given)
      given.deep.level = 2

      expect(values).toEqual([
        { deep: { level: 1 } },
        { deep: { level: 1 } },
        { deep: { level: 1 } }
      ])
      const [first] = values
      assert(typeof first === 'object' && first !== null && 'deep' in first)
      expect(new Set(values)).toEqual(new Set([first]))
      expect(first).not.toBe(given)
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(first.deep)).toBe(true)
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
      onTestFinished(
        defs.extend(packId, 'Fixed', (builder) =>
          builder.onPropertyChanged(onPropertyChanged)
        )
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

  describe('onDragOver', () => {
    const drag = () => new DragEvent('dragover')

    it('marks a node as the drop target when a hook accepts, given its handle and the browser event', () => {
      const asked: [string, DragEvent][] = []
      extend((builder) =>
        builder.onDragOver((handle, event) => {
          asked.push([handle.id, event])
          return true
        })
      )
      const node = probe()
      const event = drag()

      expect(node.onDragOver?.(event)).toBe(true)
      expect(asked).toEqual([[String(node.id), event]])
      expect(asked[0][1]).toBe(event)
    })

    it('does not mark it when no hook returns true, even one that throws', () => {
      extend((builder) => {
        builder.onDragOver(() => false)
        builder.onDragOver(() => {})
        builder.onDragOver(() => {
          throw new Error('hook failed')
        })
      })
      const node = probe()

      expect(node.onDragOver?.(drag())).toBe(false)
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('does not mark it for an answer that is truthy but not true', () => {
      extend((builder) =>
        Reflect.apply(builder.onDragOver, builder, [() => 'yes'])
      )
      const node = probe()

      expect(node.onDragOver?.(drag())).toBe(false)
    })

    it('marks it when any hook accepts, whatever the others answer', () => {
      extend((builder) => builder.onDragOver(() => false))
      extend((builder) => builder.onDragOver(() => true))
      const node = probe()

      expect(node.onDragOver?.(drag())).toBe(true)
    })

    it('asks no hook once the extension is disposed', () => {
      const accept = vi.fn(() => true)
      const stop = extend((builder) => builder.onDragOver(accept))
      const node = probe()

      stop()

      expect(node.onDragOver?.(drag())).toBe(false)
      expect(accept).not.toHaveBeenCalled()
    })

    it('keeps an acceptance the type itself makes, without asking the hooks', () => {
      class Accepting extends LGraphNode {
        override onDragOver() {
          return true
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(
        Accepting,
        hostNodeDef('Accepting')
      )
      LiteGraph.registerNodeType('Accepting', Accepting)
      const refuse = vi.fn(() => false)
      onTestFinished(
        defs.extend(packId, 'Accepting', (builder) =>
          builder.onDragOver(refuse)
        )
      )
      const node = LiteGraph.createNode('Accepting')
      assert(node)
      graph.add(node)

      expect(node.onDragOver?.(drag())).toBe(true)
      expect(refuse).not.toHaveBeenCalled()
    })

    it('asks the hooks when the type itself does not accept', () => {
      const own: string[] = []
      class Declining extends LGraphNode {
        override onDragOver() {
          own.push('onDragOver')
          return false
        }
      }
      host.nodeTypeHooks.beforeRegisterNodeDef(
        Declining,
        hostNodeDef('Declining')
      )
      LiteGraph.registerNodeType('Declining', Declining)
      onTestFinished(
        defs.extend(packId, 'Declining', (builder) =>
          builder.onDragOver(() => true)
        )
      )
      const node = LiteGraph.createNode('Declining')
      assert(node)
      graph.add(node)

      expect(node.onDragOver?.(drag())).toBe(true)
      expect(own).toEqual(['onDragOver'])
    })
  })

  describe('onDrop', () => {
    const drop = () => new DragEvent('drop')

    it('claims the drop when a hook answers true, given the node handle and the browser event', async () => {
      const asked: [string, DragEvent][] = []
      extend((builder) =>
        builder.onDrop((handle, event) => {
          asked.push([handle.id, event])
          return true
        })
      )
      const node = probe()
      const event = drop()

      await expect(node.onDragDrop?.(event)).resolves.toBe(true)
      expect(asked).toEqual([[String(node.id), event]])
      expect(asked[0][1]).toBe(event)
    })

    it('waits for a hook that answers with a promise', async () => {
      let answer: (claimed: boolean) => void = () => {}
      extend((builder) =>
        builder.onDrop(
          () =>
            new Promise<boolean>((resolve) => {
              answer = resolve
            })
        )
      )
      const node = probe()
      let settled = false
      const claimed = node.onDragDrop?.(drop())
      void Promise.resolve(claimed).then(() => {
        settled = true
      })

      await Promise.resolve()
      expect(settled).toBe(false)
      answer(true)

      await expect(claimed).resolves.toBe(true)
    })

    it('asks the hooks during the call, while the drop event is still being delivered', () => {
      const asked = vi.fn()
      extend((builder) => builder.onDrop(asked))
      const node = probe()

      void node.onDragDrop?.(drop())

      expect(asked).toHaveBeenCalledOnce()
    })

    it('leaves the drop to the editor when no hook claims it, reporting one that throws or rejects', async () => {
      extend((builder) => {
        builder.onDrop(() => false)
        builder.onDrop(() => {})
        builder.onDrop(async () => undefined)
        builder.onDrop(() => {
          throw new Error('hook failed')
        })
        builder.onDrop(() => Promise.reject(new Error('hook rejected')))
      })
      const node = probe()

      await expect(node.onDragDrop?.(drop())).resolves.toBe(false)
      expect(reportError).toHaveBeenCalledTimes(2)
    })

    it('leaves the drop to the editor for an answer that is truthy but not true', async () => {
      extend((builder) =>
        Reflect.apply(builder.onDrop, builder, [async () => 'yes'])
      )
      const node = probe()

      await expect(node.onDragDrop?.(drop())).resolves.toBe(false)
    })

    it('claims it when any hook claims it, and asks every hook', async () => {
      const later = vi.fn(() => false)
      extend((builder) => builder.onDrop(async () => true))
      extend((builder) => builder.onDrop(later))
      const node = probe()

      await expect(node.onDragDrop?.(drop())).resolves.toBe(true)
      expect(later).toHaveBeenCalledOnce()
    })

    it('asks no hook once the extension is disposed', async () => {
      const claim = vi.fn(() => true)
      const stop = extend((builder) => builder.onDrop(claim))
      const node = probe()

      stop()

      await expect(node.onDragDrop?.(drop())).resolves.toBe(false)
      expect(claim).not.toHaveBeenCalled()
    })

    it.for([
      { own: 'claims it', claimed: true, hooksAsked: 0 },
      { own: 'leaves it', claimed: false, hooksAsked: 1 }
    ])(
      'asks the hooks only when the type itself $own',
      async ({ claimed, hooksAsked }) => {
        const own: DragEvent[] = []
        class Dropping extends LGraphNode {
          override async onDragDrop(event: DragEvent) {
            own.push(event)
            return claimed
          }
        }
        host.nodeTypeHooks.beforeRegisterNodeDef(
          Dropping,
          hostNodeDef('Dropping')
        )
        LiteGraph.registerNodeType('Dropping', Dropping)
        const hook = vi.fn(() => false)
        onTestFinished(
          defs.extend(packId, 'Dropping', (builder) => builder.onDrop(hook))
        )
        const node = LiteGraph.createNode('Dropping')
        assert(node)
        graph.add(node)
        const event = drop()

        await expect(node.onDragDrop?.(event)).resolves.toBe(claimed)
        expect(own).toEqual([event])
        expect(hook).toHaveBeenCalledTimes(hooksAsked)
      }
    )
  })

  describe('in app mode', () => {
    it('asks no hook when the methods run on app mode’s copy of the node, though the node itself asks them', async () => {
      const over = vi.fn(() => true)
      const dropped = vi.fn(() => true)
      extend((builder) => {
        builder.onDragOver(over)
        builder.onDrop(dropped)
      })
      const node = probe()
      const copy = {
        ...node._state,
        onDragOver: node.onDragOver,
        onDragDrop: node.onDragDrop
      }
      const event = new DragEvent('drop')

      expect(copy.onDragOver?.(event)).toBe(false)
      await expect(copy.onDragDrop?.(event)).resolves.toBe(false)
      expect(over).not.toHaveBeenCalled()
      expect(dropped).not.toHaveBeenCalled()

      expect(node.onDragOver?.(event)).toBe(true)
      await expect(node.onDragDrop?.(event)).resolves.toBe(true)
      expect(over).toHaveBeenCalledOnce()
      expect(dropped).toHaveBeenCalledOnce()
    })
  })

  describe('a defined type', () => {
    it('runs the connection and property hooks its definition declares', () => {
      const onConnectionsChanged = vi.fn()
      const onPropertyChanged = vi.fn()
      onTestFinished(
        defs.define(packId, {
          type: 'Defined',
          inputs: [{ name: 'in', type: '*' }],
          onConnectionsChanged,
          onPropertyChanged
        })
      )
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
