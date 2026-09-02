import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { setActiveLocale } from '@/i18n'

import { createComfyApi } from './comfyApi'
import {
  notifyDefsRefreshed,
  createDefRegistry,
  deliverPreview,
  frontendResolverMap,
  frontendSupplierMap,
  offerUnplacedLink,
  projectedPromptInputOmissions,
  provideGraphLoadingState,
  reapplyPackTypeColors
} from './defsRegistry'
import type { Comfy } from './comfyApi'
import type {
  DefSelector,
  NodeCreatedEvent,
  NodeDefBuilder,
  UnplacedLinkEvent
} from './defsRegistry'
import type { NodeHandle } from './nodeHandle'

const RAW_DEF = {
  name: 'KSampler',
  display_name: 'K Sampler',
  category: 'sampling',
  python_module: 'custom_nodes.demo',
  output: ['LATENT'],
  output_name: ['LATENT'],
  input: {
    required: { seed: ['INT', {}], mode: [['a', 'b'], {}] },
    optional: { model: ['MODEL', {}] }
  }
}

/** A node class shaped like the one litegraph generates for a def. */
function nodeClass(type: string) {
  class Generated extends LGraphNode {
    constructor() {
      super(type)
    }
  }
  return Generated
}

const { refreshComboInNodes } = vi.hoisted(() => ({
  refreshComboInNodes: vi.fn(async () => {})
}))
vi.mock('@/scripts/app', () => ({ app: { refreshComboInNodes } }))

describe('defs.extend', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  describe('the definition handed to an extension', () => {
    it('exposes inputs, outputs and source from the backend shape', () => {
      const registry = createDefRegistry()
      const seen = vi.fn()
      registry.forMajor(() => comfy.graph.node('1')!).extend('KSampler', seen)
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)

      const { def } = seen.mock.calls[0][0]
      expect(def.title).toBe('K Sampler')
      expect(def.source).toBe('custom_nodes.demo')
      expect(def.inputs).toEqual([
        { name: 'seed', type: 'INT', options: {} },
        { name: 'mode', type: 'COMBO', values: ['a', 'b'], options: {} },
        { name: 'model', type: 'MODEL', options: {} }
      ])
      expect(Object.isFrozen(def.inputs[1].values)).toBe(true)
      expect(def.outputs).toEqual([{ name: 'LATENT', type: 'LATENT' }])
    })

    it('exposes the input caption rendered in the active locale', async () => {
      await setActiveLocale('zh')
      try {
        const registry = createDefRegistry()
        const seen = vi.fn<(builder: NodeDefBuilder) => void>()
        registry.forMajor(() => comfy.graph.node('1')!).extend('KSampler', seen)
        registry.applyTo(nodeClass('KSampler'), RAW_DEF)

        const { def } = seen.mock.calls[0][0]
        expect(def.inputs.find(({ name }) => name === 'seed')).toMatchObject({
          localizedName: '种子'
        })
      } finally {
        await setActiveLocale('en')
      }
    })

    it('carries hidden declarations without turning them into slots', () => {
      // easy-use and tinyterraNodes both ship an XY-plot axis catalogue as
      // input.hidden.plot_dict[0] and read it back. Listing it in `inputs`
      // instead would put a connectable slot on the node for something the
      // server fills in, so it is reachable but separate.
      const registry = createDefRegistry()
      const seen = vi.fn()
      registry.forMajor(() => comfy.graph.node('1')!).extend('XYPlot', seen)
      registry.applyTo(nodeClass('XYPlot'), {
        name: 'XYPlot',
        input: {
          required: { steps: ['INT', { default: 20 }] },
          hidden: { plot_dict: [{ seed: ['a', 'b'] }], prompt: 'PROMPT' }
        }
      })

      const { def } = seen.mock.calls[0][0]
      expect(def.hidden.plot_dict).toEqual([{ seed: ['a', 'b'] }])
      expect(def.hidden.prompt).toBe('PROMPT')
      expect(def.inputs).toHaveLength(1)
      expect(def.inputs[0].name).toBe('steps')
    })

    it("carries an input's declaration dict, including the pack's own keys", () => {
      // A pack declares bespoke keys on its own Python input spec and reads
      // them back to drive frontend behaviour. Dropping unrecognised keys
      // broke the pack against its own data.
      const registry = createDefRegistry()
      const seen = vi.fn()
      registry.forMajor(() => comfy.graph.node('1')!).extend('Loader', seen)
      registry.applyTo(nodeClass('Loader'), {
        name: 'Loader',
        input: {
          required: {
            file: [['a.txt'], { 'pysssss.binding': [{ source: 'root_dir' }] }],
            count: ['INT', { default: 4, min: 1 }]
          }
        }
      })

      const { def } = seen.mock.calls[0][0]
      expect(def.inputs[0].options['pysssss.binding']).toEqual([
        { source: 'root_dir' }
      ])
      expect(def.inputs[1].options).toEqual({ default: 4, min: 1 })
    })

    it('publishes choices from both COMBO declaration formats', () => {
      const registry = createDefRegistry()
      const seen = vi.fn<(builder: NodeDefBuilder) => void>()
      registry.forMajor(() => comfy.graph.node('1')!).extend('Choices', seen)
      registry.applyTo(nodeClass('Choices'), {
        name: 'Choices',
        input: {
          required: {
            legacy: [['fast', 'quality'], {}],
            current: ['COMBO', { options: [1, 2] }]
          }
        }
      })

      const { def } = seen.mock.calls[0][0]
      expect(def.inputs.map(({ values }) => values)).toEqual([
        ['fast', 'quality'],
        [1, 2]
      ])
    })

    it('is frozen, so an extension cannot mutate what the next one sees', () => {
      const registry = createDefRegistry()
      registry
        .forMajor(() => comfy.graph.node('1')!)
        .extend('KSampler', ({ def }) => {
          expect(() => {
            // @ts-expect-error -- the point of the test
            def.title = 'hijacked'
          }).toThrow()
        })
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)
    })
  })

  describe('selectors', () => {
    const selectorCases = [
      ['exact type', 'KSampler', true],
      ['non-matching type', 'Other', false],
      ['list membership', ['A', 'KSampler'], true],
      ['regex', /^KSam/, true],
      ['non-matching regex', /^Nope/, false],
      ['category', { category: 'sampling' }, true],
      ['wrong category', { category: 'loaders' }, false],
      ['category prefix', { category: /^samp/ }, true],
      ['non-matching category prefix', { category: /^load/ }, false]
    ] as const

    it.for(selectorCases)('%s', ([, selector, shouldMatch]) => {
      const registry = createDefRegistry()
      const apply = vi.fn()
      registry
        .forMajor(() => comfy.graph.node('1')!)
        .extend(selector as DefSelector, apply)
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)
      expect(apply).toHaveBeenCalledTimes(shouldMatch ? 1 : 0)
    })

    it('rejects a selector shape it does not understand', () => {
      // A silently non-matching selector is the worst outcome: the pack looks
      // converted and its behaviour is simply gone.
      const registry = createDefRegistry()
      const api = registry.forMajor((id) => comfy.graph.node(id)!)
      expect(() =>
        api.extend({ test: () => true } as unknown as DefSelector, () => {})
      ).toThrow(/Unrecognised def selector/)
    })

    it('does not install any hook when nothing matches', () => {
      const registry = createDefRegistry()
      const Generated = nodeClass('KSampler')
      const before = Generated.prototype.onAdded
      registry.forMajor(() => comfy.graph.node('1')!).extend('Other', () => {})
      registry.applyTo(Generated, RAW_DEF)
      expect(Generated.prototype.onAdded).toBe(before)
    })
  })

  describe('lifecycle', () => {
    /** Registers extensions, then constructs and adds a node of that type. */
    function addNode(
      extend: (registry: ReturnType<typeof createDefRegistry>) => void
    ) {
      const registry = createDefRegistry()
      extend(registry)
      const Generated = nodeClass('KSampler')
      registry.applyTo(Generated, RAW_DEF)
      const node = new Generated()
      graph.add(node)
      return node
    }

    it('clamps a hand-entered property instead of discarding it', () => {
      // litegraph's own callback can only veto, which throws the user's input
      // away. rgthree clamps a seed's randomMax as it is typed.
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onPropertyChanged((_n, e) => {
              if (e.name === 'randomMax' && Number(e.value) > 100)
                e.setValue(100)
            })
          )
      )

      node.setProperty('randomMax', 5000)
      expect(node.properties['randomMax']).toBe(100)

      node.setProperty('randomMax', 50)
      expect(node.properties['randomMax']).toBe(50)
    })

    it('does not recurse when a handler replaces the value', () => {
      const seen: unknown[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onPropertyChanged((_n, e) => {
              seen.push(e.value)
              e.setValue(1)
            })
          )
      )

      node.setProperty('x', 99)

      expect(seen).toEqual([99])
      expect(node.properties['x']).toBe(1)
    })

    it('reaches a type the pack defines itself, not just an extended one', () => {
      setActivePinia(createPinia())
      const graph = new LGraph()
      const api = createComfyApi(() => graph)
      api.defs.define({
        type: 'DefinedClamp',
        onPropertyChanged: (_n, e) => {
          if (Number(e.value) > 10) e.setValue(10)
        }
      })
      const node = LiteGraph.createNode('DefinedClamp')!
      graph.add(node)

      node.setProperty('x', 99)

      expect(node.properties['x']).toBe(10)
    })

    it('keeps a widget bound to the property in step with the clamp', () => {
      // setProperty syncs bound widgets AFTER the callback, from the value the
      // caller passed — so a replacement that only writes `properties` leaves
      // the widget showing what the user typed and the property holding the
      // clamp.
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onPropertyChanged((_n, e) => {
              if (Number(e.value) > 100) e.setValue(100)
            })
          )
      )
      const widget = node.addWidget('number', 'bound', 0, () => {}, {
        property: 'randomMax'
      })

      node.setProperty('randomMax', 5000)

      expect(node.properties['randomMax']).toBe(100)
      expect(widget.value).toBe(100)
    })

    it('restores the previous value when a handler rejects', () => {
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onPropertyChanged((_n, e) => {
              if (Number(e.value) < 0) e.reject()
            })
          )
      )
      node.setProperty('x', 7)

      node.setProperty('x', -1)

      expect(node.properties['x']).toBe(7)
    })

    it('names the node at the other end of a new connection', () => {
      // Packs read link_info.origin_id to decide what the new neighbour means.
      // Knowing only that something connected forced a re-walk of the graph.
      const seen: unknown[] = []
      const target = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onConnectionsChanged((_n, e) => seen.push(e))
          )
      )
      target.addInput('in', 'IMAGE')
      const source = new LGraphNode('Src')
      source.addOutput('out', 'IMAGE')
      graph.add(source)

      source.connect(0, target, 0)

      expect(seen.at(-1)).toMatchObject({
        side: 'input',
        connected: true,
        peerNodeId: String(source.id),
        peerIndex: 0
      })
    })

    it('reports a resize', () => {
      const sizes: unknown[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onResized((_n, size) => sizes.push(size))
          )
      )

      node.setSize([320, 180])

      expect(sizes.at(-1)).toEqual({ width: 320, height: 180 })
    })

    it('reports the pointer entering and leaving', () => {
      // Packs read canvas.node_over or set node.mouseOver — canvas internals,
      // and the canvas is what Nodes 2.0 replaces.
      const seen: boolean[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onHover((_n, hovering) => seen.push(hovering))
          )
      )

      node.onMouseEnter?.(undefined as never)
      node.onMouseLeave?.(undefined as never)

      expect(seen).toEqual([true, false])
    })

    it('reports a double click, without coordinates', () => {
      const seen: string[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) => b.onDoubleClick((n) => seen.push(n.id)))
      )

      node.onDblClick?.(undefined as never, [0, 0], undefined as never)

      expect(seen).toEqual([String(node.id)])
    })

    it('fires onCreated once the node is addressable', () => {
      const seen: (string | undefined)[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onCreated((handle) => seen.push(handle.id))
          )
      )
      // The handle resolves to the real node — the whole reason onCreated is
      // bound to onAdded rather than litegraph's pre-insert onNodeCreated.
      expect(seen).toEqual([String(node.id)])
      expect(comfy.graph.node(seen[0]!)?.isDeleted).toBe(false)
    })

    it('creates widgets declared by addWidget', () => {
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.addWidget({
              type: 'textarea',
              name: 'readout',
              value: 'hello',
              disabled: true
            })
          )
      )
      const widget = comfy.graph.node(String(node.id))!.widgets.get('readout')
      expect(widget?.widgetType).toBe('textarea')
      expect(widget?.getValue()).toBe('hello')
      expect(widget?.isDisabled()).toBe(true)
      expect(node.widgets?.map((w) => w.name)).toContain('readout')
    })

    it('delivers execution results as a normalised shape', () => {
      const results: unknown[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onExecuted((_n, result) => results.push(result))
          )
      )
      node.onExecuted?.({ text: ['a', 'b'], custom: 7 } as never)
      expect(results).toEqual([
        { images: [], text: ['a', 'b'], raw: { text: ['a', 'b'], custom: 7 } }
      ])
    })

    it('reports connection changes with a named side', () => {
      const events: unknown[] = []
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) =>
            b.onConnectionsChanged((_n, event) => events.push(event))
          )
      )
      const slot = {} as INodeInputSlot
      node.onConnectionsChange?.(1, 0, true, undefined, slot)
      node.onConnectionsChange?.(2, 3, false, undefined, slot)
      expect(events).toEqual([
        { side: 'input', index: 0, connected: true },
        { side: 'output', index: 3, connected: false }
      ])
    })

    it('fires onRemoved when the node leaves the graph', () => {
      const removed = vi.fn()
      const node = addNode((registry) =>
        registry
          .forMajor((id) => comfy.graph.node(id)!)
          .extend('KSampler', (b) => b.onRemoved(removed))
      )
      graph.remove(node)
      expect(removed).toHaveBeenCalledOnce()
    })
  })

  describe('composition', () => {
    it('runs every extension in registration order', () => {
      const order: number[] = []
      const registry = createDefRegistry()
      const api = registry.forMajor((id) => comfy.graph.node(id)!)
      for (const n of [1, 2, 3]) {
        api.extend('KSampler', (b) => b.onCreated(() => order.push(n)))
      }
      const Generated = nodeClass('KSampler')
      registry.applyTo(Generated, RAW_DEF)
      graph.add(new Generated())
      expect(order).toEqual([1, 2, 3])
    })

    it('still calls a legacy prototype patch that was applied first', () => {
      const legacy = vi.fn()
      const registered = vi.fn()
      const registry = createDefRegistry()
      registry
        .forMajor((id) => comfy.graph.node(id)!)
        .extend('KSampler', (b) => b.onCreated(registered))

      const Generated = nodeClass('KSampler')
      Generated.prototype.onAdded = legacy
      registry.applyTo(Generated, RAW_DEF)
      graph.add(new Generated())

      // An unconverted pack sharing the type must keep working during the
      // migration, so the pre-existing patch is chained rather than replaced.
      expect(legacy).toHaveBeenCalledOnce()
      expect(registered).toHaveBeenCalledOnce()
    })

    it('does not let one failing extension suppress the others', () => {
      const survivor = vi.fn()
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const registry = createDefRegistry()
      const api = registry.forMajor((id) => comfy.graph.node(id)!)
      api.extend('KSampler', () => {
        throw new Error('boom')
      })
      api.extend('KSampler', (b) => b.onCreated(survivor))

      const Generated = nodeClass('KSampler')
      registry.applyTo(Generated, RAW_DEF)
      graph.add(new Generated())
      expect(survivor).toHaveBeenCalledOnce()
    })

    it('stops invoking an extension after it is unsubscribed', () => {
      const apply = vi.fn()
      const registry = createDefRegistry()
      const off = registry
        .forMajor((id) => comfy.graph.node(id)!)
        .extend('KSampler', apply)
      off()
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)
      expect(apply).not.toHaveBeenCalled()
    })
  })

  describe('the registry as a catalogue', () => {
    it('records definitions it has seen, whether or not they matched', () => {
      const registry = createDefRegistry()
      const api = registry.forMajor((id) => comfy.graph.node(id)!)
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)
      expect(api.has('KSampler')).toBe(true)
      expect(api.get('KSampler')?.category).toBe('sampling')
      expect(api.all()).toHaveLength(1)
    })

    it('reflects a title an extension changed', () => {
      const registry = createDefRegistry()
      const api = registry.forMajor((id) => comfy.graph.node(id)!)
      api.extend('KSampler', (b) => b.setTitle('Renamed'))
      registry.applyTo(nodeClass('KSampler'), RAW_DEF)
      expect(api.get('KSampler')?.title).toBe('Renamed')
    })
  })

  describe('serialization control', () => {
    it('keeps a widget out of the saved workflow', () => {
      const registry = createDefRegistry()
      registry
        .forMajor((id) => comfy.graph.node(id)!)
        .extend('KSampler', (b) =>
          b.addWidget({
            type: 'textarea',
            name: 'readout',
            serialize: false
          })
        )
      const Generated = nodeClass('KSampler')
      registry.applyTo(Generated, RAW_DEF)
      const node = new Generated()
      graph.add(node)

      // Replaces `widget.serializeValue = async () => {}`.
      expect(node.widgets?.find((w) => w.name === 'readout')?.serialize).toBe(
        false
      )
    })

    it('lets a node opt out of emitting widgets_values entirely', () => {
      const Generated = nodeClass('KSampler')
      const node = new Generated()
      graph.add(node)
      const handle = comfy.graph.node(String(node.id))!

      handle.setSerializeWidgets(true)
      expect(node.serialize_widgets).toBe(true)
      handle.setSerializeWidgets(false)
      expect(node.serialize_widgets).toBe(false)
    })
  })

  it('is advertised as a capability', () => {
    expect(comfy.supports('defs.extend')).toBe(true)
    expect(comfy.supports('defs.inputValues')).toBe(true)
    expect(comfy.supports('widgets.create')).toBe(true)
    expect(comfy.supports('serialization.control')).toBe(true)
    expect(() => comfy.require('defs.extend')).not.toThrow()
  })
})

describe('a defined node type', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  it('saves its widget values, as the host-generated class does', () => {
    // `LGraphNode.serialize` gates `widgets_values` on `serialize_widgets`,
    // which is off unless something sets it. The host's own node class does;
    // a defined one did not, so every value vanished from the saved workflow
    // with no error — visible only after a reload.
    const defs = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)
    const stop = defs.define({
      type: 'DefinedSampler',
      widgets: [{ type: 'string', name: 'key', value: 'kept' }]
    })

    try {
      const node = LiteGraph.createNode('DefinedSampler')!
      graph.add(node)

      expect(node.serialize().widgets_values).toEqual(['kept'])
    } finally {
      stop()
    }
  })

  it('keeps declared widget values when duplicated', () => {
    const defs = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)
    const stop = defs.define({
      type: 'DefinedPrompt',
      widgets: [{ type: 'string', name: 'prompt', value: '' }]
    })

    try {
      const original = LiteGraph.createNode('DefinedPrompt')!
      graph.add(original)
      comfy.graph
        .node(String(original.id))!
        .widgets.get('prompt')!
        .setValue('keep me')

      const copy = comfy.graph.duplicate(String(original.id))!

      expect(copy.widgets.get('prompt')!.getValue()).toBe('keep me')
    } finally {
      stop()
    }
  })

  it('shapes a declared output, because the shape is saved with it', () => {
    // rgthree's relay draws an arrow on the one output that may only reach a
    // repeater. Declaring the output without it saved one field fewer than the
    // same node saved before the migration.
    const defs = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)
    const stop = defs.define({
      type: 'DefinedRelay',
      outputs: [
        { name: 'REPEATER', type: '_NODE_REPEATER_', shape: 'directional' },
        { name: 'plain', type: 'IMAGE' }
      ]
    })

    try {
      const node = LiteGraph.createNode('DefinedRelay')!
      graph.add(node)
      const saved = node.serialize().outputs!

      expect(saved.find((o) => o.name === 'REPEATER')?.shape).toBe(
        RenderShape.ARROW
      )
      expect(saved.find((o) => o.name === 'plain')?.shape).toBeUndefined()
    } finally {
      stop()
    }
  })
})

describe('how a node arrived', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
    provideGraphLoadingState(() => false)
  })

  function watched() {
    const seen: NodeCreatedEvent[] = []
    const registry = createDefRegistry()
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.onCreated((_n, event) => seen.push(event)))
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    // Registered so clone() can build one: it goes through the registry, and
    // an unregistered type clones to null.
    LiteGraph.registerNodeType('KSampler', Generated)
    return { seen, make: () => LiteGraph.createNode('KSampler')! }
  }

  it('says a fresh node carries no saved state', () => {
    const { seen, make } = watched()

    graph.add(make())

    expect(seen).toEqual([{ restored: false, loading: false }])
  })

  it('says a duplicated node does', () => {
    // Packs overrode clone() to reset what a copy must not inherit — dynamic
    // slots the original's upstream fed, a reroute born hard-typed. clone()
    // runs before the node has an id, so there is nothing to hand a pack
    // there; by onCreated there is.
    const { seen, make } = watched()
    const original = make()
    graph.add(original)
    seen.length = 0

    graph.add(original.clone()!)

    expect(seen).toEqual([{ restored: true, loading: false }])
  })

  it('separates a workflow load from a paste', () => {
    // The whole point of the second field: a pasted node should drop slots it
    // can no longer be fed through, and a loaded one must keep every one of
    // them or the workflow opens wrong.
    provideGraphLoadingState(() => true)
    const { seen, make } = watched()
    const original = make()
    graph.add(original)
    seen.length = 0

    graph.add(original.clone()!)

    expect(seen).toEqual([{ restored: true, loading: true }])
  })
})

describe('a link no single slot fits', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  function bundleNode(
    run: (node: NodeHandle, event: UnplacedLinkEvent) => boolean | void
  ) {
    const registry = createDefRegistry()
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.onUnplacedLink(run))
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)
    return node
  }

  const drop = Object.freeze({
    side: 'output' as const,
    peerNodeId: '99',
    peerIndex: 0,
    type: 'CONTEXT',
    replaceExisting: false
  })

  it('offers the drop to the type that registered for it', () => {
    let seen: UnplacedLinkEvent | undefined
    const node = bundleNode((_n, event) => {
      seen = event
      return true
    })

    const placed = offerUnplacedLink(String(node.id), 'KSampler', drop)

    expect(placed).toBe(true)
    expect(seen).toEqual(drop)
  })

  it('says the drop is unplaced when the listener declines', () => {
    // Declining must not read as handled, or the host stops reporting a drop
    // that really did go nowhere.
    const node = bundleNode(() => undefined)

    expect(offerUnplacedLink(String(node.id), 'KSampler', drop)).toBe(false)
  })

  it('stops at the first listener that claims it', () => {
    // Two packs extending one type must not both wire the same gesture.
    const calls: string[] = []
    const registry = createDefRegistry()
    const api = registry.forMajor((id) => comfy.graph.node(id)!)
    api.extend('KSampler', (b) =>
      b.onUnplacedLink(() => {
        calls.push('first')
        return true
      })
    )
    api.extend('KSampler', (b) =>
      b.onUnplacedLink(() => {
        calls.push('second')
        return true
      })
    )
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)

    offerUnplacedLink(String(node.id), 'KSampler', drop)

    expect(calls).toEqual(['first'])
  })

  it('has nothing to say about a type nobody registered for', () => {
    expect(offerUnplacedLink('1', 'NeverSeen', drop)).toBe(false)
  })
})

describe('setSupply', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  it('reaches a type the backend already registered', () => {
    // The whole point: broadcast packs declare their types in Python, and
    // `defs.define` refuses a type that already exists — which left `supply`
    // unreachable for every pack that needed it.
    const registry = createDefRegistry()
    const supply = vi.fn(() => [])
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.setSupply(supply))
    registry.applyTo(nodeClass('KSampler'), RAW_DEF)

    expect(frontendSupplierMap().get('KSampler')).toBe(supply)
  })

  it('does not require the node to be frontend-only', () => {
    // Feeding somebody else and being skipped by the prompt builder are
    // separate questions; a node may both execute and broadcast.
    const registry = createDefRegistry()
    const supply = vi.fn(() => [])
    const Generated = nodeClass('KSampler')
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.setSupply(supply))
    registry.applyTo(Generated, RAW_DEF)

    expect(frontendSupplierMap().has('KSampler')).toBe(true)
    expect(Generated.prototype.isVirtualNode).toBeUndefined()
  })

  it('composes suppliers registered by different extensions', async () => {
    const registry = createDefRegistry()
    const first = vi.fn(() => [])
    const second = vi.fn(() => [])
    const api = registry.forMajor((id) => comfy.graph.node(id)!)
    api.extend('KSampler', (b) => b.setSupply(first))
    api.extend('KSampler', (b) => b.setSupply(second))
    registry.applyTo(nodeClass('KSampler'), RAW_DEF)

    await frontendSupplierMap().get('KSampler')!(undefined as never)

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })
})

describe('defs.refresh', () => {
  it('asks the host to reload definitions', async () => {
    // Backend-supplied combo values (model lists, LoRA names) are captured
    // when definitions load, so a pack that writes a file server-side leaves
    // every open picker showing the old list.
    setActivePinia(createPinia())
    const graph = new LGraph()
    const api = createComfyApi(() => graph)
    await api.defs.refresh()

    expect(refreshComboInNodes).toHaveBeenCalledTimes(1)
  })
})

describe('defs.onRefreshed', () => {
  it('tells packs when definitions were reloaded, until unsubscribed', () => {
    // The pack that caused a refresh is usually not the pack holding a stale
    // cached copy of a combo's values, so refresh() alone is not enough.
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())
    const listener = vi.fn()
    const stop = api.defs.onRefreshed(listener)

    notifyDefsRefreshed()
    expect(listener).toHaveBeenCalledTimes(1)

    stop()
    notifyDefsRefreshed()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('runs later listeners after an earlier one throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())
    const after = vi.fn()
    const stopFirst = api.defs.onRefreshed(() => {
      throw new Error('pack is broken')
    })
    const stopAfter = api.defs.onRefreshed(after)

    expect(() => notifyDefsRefreshed()).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    stopFirst()
    stopAfter()
  })
})

describe('extend after define', () => {
  it('says so loudly instead of dropping the registration', () => {
    // define installs prototype behaviour before returning, so a later extend
    // is never applied. A hook that silently never fires costs an afternoon.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())
    api.defs.define({ type: 'LateExtended' })

    api.defs.extend('LateExtended', (b) => b.onCreated(() => {}))

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("extend('LateExtended') was called after")
    )
  })

  it('stays quiet when the extension is registered first', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    error.mockClear()
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    api.defs.extend('EarlyExtended', (b) => b.onCreated(() => {}))
    api.defs.define({ type: 'EarlyExtended' })

    expect(error).not.toHaveBeenCalled()
  })
})

describe('type colours', () => {
  it('reports the colour a type is drawn in, and a default for unknown ones', () => {
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    expect(api.defs.typeColor('number')).toBe('#AAA')
    expect(api.defs.typeColor('NOTHING_KNOWS_THIS')).toBeTruthy()
  })

  it('resolves a palette name to the colours the user actually sees', () => {
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    // Whatever the palette holds is the right answer; hardcoding hexes here
    // would only assert that this test and LGraphCanvas were edited together.
    // What must hold is that the three fields are not crossed — a filter for
    // "red groups" comparing against the title-bar colour matches nothing.
    const palette = LGraphCanvas.node_colors['pale_blue']
    expect(api.defs.nodeColor('pale_blue')).toEqual({
      color: palette.color,
      bgColor: palette.bgcolor,
      groupColor: palette.groupcolor
    })
    expect(api.defs.nodeColor('no_such_colour')).toBeUndefined()
  })

  it('lets a pack colour a type it introduces, and take it back', () => {
    // Packs shipping their own types wrote straight into link_type_colors so
    // their links were not all grey.
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    const undo = api.defs.setTypeColor('LORA_STACK', '#c9a')
    expect(api.defs.typeColor('LORA_STACK')).toBe('#c9a')

    undo()
    expect(api.defs.typeColor('LORA_STACK')).not.toBe('#c9a')
  })

  it('survives a palette load wiping the table', () => {
    // loadLinkColorPalette assigns over link_type_colors with every known type
    // mapped to '', so a pack's colour was erased whenever the user changed
    // theme. The pack's choice is held apart and re-applied.
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())
    api.defs.setTypeColor('PIPE_LINE', '#c9a')

    // What the palette service does.
    Object.assign(LGraphCanvas.link_type_colors, { PIPE_LINE: '' })
    expect(LGraphCanvas.link_type_colors['PIPE_LINE']).toBe('')
    reapplyPackTypeColors()

    expect(LGraphCanvas.link_type_colors['PIPE_LINE']).toBe('#c9a')
    expect(api.defs.typeColor('PIPE_LINE')).toBe('#c9a')
  })

  it('does not treat a palette-seeded placeholder as the host claiming a type', () => {
    // The seeding writes '' for every known type, so key existence is not
    // ownership — only a non-empty value is.
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())
    Object.assign(LGraphCanvas.link_type_colors, { XYPLOT: '' })

    expect(() => api.defs.setTypeColor('XYPLOT', '#abc')).not.toThrow()
    expect(api.defs.typeColor('XYPLOT')).toBe('#abc')
  })

  it('refuses to recolour a type the host already owns', () => {
    // That write is global: one pack recolouring a core type restyles every
    // graph for every other pack, and the user cannot see who did it.
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    expect(() => api.defs.setTypeColor('number', '#f00')).toThrow(
      /already colours/
    )
    expect(api.defs.typeColor('number')).toBe('#AAA')
  })
})

describe('slot type compatibility', () => {
  it.for([
    ['IMAGE', 'IMAGE', true],
    ['IMAGE', '*', true],
    ['IMAGE,LATENT', 'LATENT', true],
    ['IMAGE', 'LATENT', false]
  ] as const)('$0 -> $1 is $2', ([output, input, compatible]) => {
    setActivePinia(createPinia())
    const api = createComfyApi(() => new LGraph())

    expect(api.defs.isTypeCompatible(output, input)).toBe(compatible)
  })
})

describe('preview frames', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('delivers a frame only to the type that registered for it', () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const registry = createDefRegistry()
    const seen: unknown[] = []

    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) =>
        b.onPreview((node, frame) => seen.push([node.id, frame.url]))
      )
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)

    const frame = { blob: new Blob(), url: 'blob:x' }
    deliverPreview(String(node.id), 'KSampler', frame)
    // A frame for a type nobody registered must not fan out to everyone.
    deliverPreview(String(node.id), 'SomethingElse', frame)

    expect(seen).toEqual([[String(node.id), 'blob:x']])
  })
})

describe('onSerialize', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  const withSerializer = (fn: (node: unknown) => Record<string, unknown>) => {
    const registry = createDefRegistry()
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.onSerialize(fn))
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)
    return node
  }

  it('merges the pack’s own keys into the saved node', () => {
    const node = withSerializer(() => ({ splinePoints: [1, 2, 3] }))
    expect(node.serialize()).toMatchObject({ splinePoints: [1, 2, 3] })
  })

  it('refuses to let a pack rewrite what the node is', () => {
    // A pack overwriting type or widgets_values changes what the workflow
    // means, which is the one thing this migration promises not to do.
    const node = withSerializer(() => ({
      type: 'SomethingElse',
      widgets_values: ['hijacked'],
      mine: 'ok'
    }))
    const serialized = node.serialize() as unknown as Record<string, unknown>
    expect(serialized.type).not.toBe('SomethingElse')
    expect(serialized.widgets_values).not.toEqual(['hijacked'])
    expect(serialized.mine).toBe('ok')
  })
})

describe('onPromptSerialize', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  function install(
    type: string,
    project: (node: NodeHandle) => { omitInputs: readonly string[] }
  ) {
    const registry = createDefRegistry()
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend(type, (builder) => builder.onPromptSerialize(project))
    const Generated = nodeClass(type)
    registry.applyTo(Generated, {
      name: type,
      output: ['STRING'],
      output_name: ['text'],
      input: {
        required: { use_input_text: ['BOOLEAN', {}] },
        optional: { text: ['STRING', { forceInput: true }] }
      }
    })
    return Generated
  }

  it('projects current state without changing the saved link', async () => {
    const Generated = install('PromptProjectionNode', (node) => ({
      omitInputs:
        node.widgets.get('use_input_text')?.getValue() === true ? [] : ['text']
    }))
    const source = new LGraphNode('Source')
    source.comfyClass = 'Source'
    source.addOutput('text', 'STRING')
    graph.add(source)

    const target = new Generated()
    target.addInput('text', 'STRING')
    target.addWidget('toggle', 'use_input_text', false, () => undefined, {})
    graph.add(target)
    source.connect(0, target, 0)

    expect(
      await projectedPromptInputOmissions(
        'PromptProjectionNode',
        String(target.id)
      )
    ).toEqual(['text'])
    const before = graph.serialize()
    const savedTarget = before.nodes.find(
      (node) => String(node.id) === String(target.id)
    )
    expect(savedTarget?.inputs?.[0].link).not.toBeNull()

    const toggle = target.widgets?.find(
      (widget) => widget.name === 'use_input_text'
    )
    expect(toggle).toBeDefined()
    toggle!.value = true
    expect(
      await projectedPromptInputOmissions(
        'PromptProjectionNode',
        String(target.id)
      )
    ).toEqual([])
    expect(
      graph
        .serialize()
        .nodes.find((node) => String(node.id) === String(target.id))
        ?.inputs?.[0].link
    ).toBe(savedTarget?.inputs?.[0].link)
  })

  it('composes omissions by union', async () => {
    const type = 'ComposedPromptProjectionNode'
    const registry = createDefRegistry()
    const api = registry.forMajor((id) => comfy.graph.node(id)!)
    api.extend(type, (builder) =>
      builder.onPromptSerialize(() => ({ omitInputs: ['text'] }))
    )
    api.extend(type, (builder) =>
      builder.onPromptSerialize(() => ({ omitInputs: ['use_input_text'] }))
    )
    registry.applyTo(nodeClass(type), {
      name: type,
      input: {
        required: { use_input_text: ['BOOLEAN', {}] },
        optional: { text: ['STRING', {}] }
      }
    })

    expect(await projectedPromptInputOmissions(type, '7')).toEqual([
      'text',
      'use_input_text'
    ])
  })

  it('fails closed on undeclared, duplicate, or broader results', async () => {
    const cases = [
      { omitInputs: ['other'] },
      { omitInputs: ['text', 'text'] },
      { omitInputs: [], replaceInputs: { text: 'no' } }
    ]
    for (const [index, result] of cases.entries()) {
      const type = `InvalidPromptProjectionNode${index}`
      install(type, () => result as { omitInputs: readonly string[] })
      await expect(projectedPromptInputOmissions(type, '9')).rejects.toThrow(
        /onPromptSerialize/
      )
    }
  })
})

describe('setSizeConstraints', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('clamps the node to its declared minimum', () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const node = new LGraphNode('t')
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))!

    handle.setSizeConstraints({ minWidth: 400, minHeight: 200 })
    expect(node.size[0]).toBeGreaterThanOrEqual(400)
    expect(node.size[1]).toBeGreaterThanOrEqual(200)
  })

  it('keeps clamping after a later resize', () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const node = new LGraphNode('t')
    graph.add(node)
    comfy.graph.node(String(node.id))!.setSizeConstraints({ minWidth: 300 })

    node.size = [50, 50]
    node.onResize?.(node.size)
    expect(node.size[0]).toBe(300)
  })

  it('reports back what was declared', () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const node = new LGraphNode('t')
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))!
    handle.setSizeConstraints({ maxWidth: 800, autoHeight: true })
    expect(handle.getSizeConstraints()).toEqual({
      maxWidth: 800,
      autoHeight: true
    })
  })
})

describe('connection veto and menu items', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
  })

  // onConnectInput's signature demands a real peer; the veto only reads the
  // node and slot index, so the peer just has to exist.
  const peerNode = new (nodeClass('Peer'))()
  const outputSlot = peerNode.addOutput('out', 'IMAGE')
  const inputSlot = peerNode.addInput('in', 'IMAGE')

  const build = (apply: (b: NodeDefBuilder) => void) => {
    const registry = createDefRegistry()
    registry.forMajor((id) => comfy.graph.node(id)!).extend('KSampler', apply)
    const Generated = nodeClass('KSampler')
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)
    return node
  }

  it('refuses a connection when a listener returns false', () => {
    const node = build((b) => b.onBeforeConnect(() => false))
    expect(node.onConnectInput?.(0, 'IMAGE', outputSlot, peerNode, 0)).toBe(
      false
    )
  })

  it('permits when no listener objects', () => {
    const node = build((b) => b.onBeforeConnect(() => undefined))
    expect(node.onConnectInput?.(0, 'IMAGE', outputSlot, peerNode, 0)).toBe(
      true
    )
  })

  it('refuses on the output side too, and says which side it is', () => {
    // side was typed 'input' | 'output' from the start but only the input
    // hook was ever installed, so it was always 'input'. A node that may only
    // feed particular types could be wired to anything and silently do
    // nothing.
    const seen: string[] = []
    const node = build((b) =>
      b.onBeforeConnect((_n, e) => {
        seen.push(e.side)
        return e.side !== 'output'
      })
    )

    expect(node.onConnectOutput?.(0, 'IMAGE', inputSlot, peerNode, 0)).toBe(
      false
    )
    expect(node.onConnectInput?.(0, 'IMAGE', outputSlot, peerNode, 0)).toBe(
      true
    )
    expect(seen).toEqual(['output', 'input'])
  })

  it('names the node and slot at the other end of each connection', () => {
    const peers: { side: string; nodeId?: string; index?: number }[] = []
    const node = build((b) =>
      b.onBeforeConnect((_n, e) => {
        peers.push({
          side: e.side,
          nodeId: e.peerNodeId,
          index: e.peerIndex
        })
      })
    )

    node.onConnectOutput?.(0, 'IMAGE', inputSlot, peerNode, 7)
    node.onConnectInput?.(0, 'IMAGE', outputSlot, peerNode, 3)

    expect(peers).toEqual([
      { side: 'output', nodeId: String(peerNode.id), index: 7 },
      { side: 'input', nodeId: String(peerNode.id), index: 3 }
    ])
  })

  it('lets any listener refuse, not just the last', () => {
    // A veto is only useful if one pack cannot be overruled by another's
    // silence.
    const node = build((b) => {
      b.onBeforeConnect(() => false)
      b.onBeforeConnect(() => true)
    })
    expect(node.onConnectInput?.(0, 'IMAGE', outputSlot, peerNode, 0)).toBe(
      false
    )
  })

  it('offers a browser drag to extensions when the host does not accept it', () => {
    const registry = createDefRegistry()
    const extension = vi.fn(() => true)
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.onDragOver(extension))
    const Generated = nodeClass('KSampler')
    const host = vi.fn(() => false)
    Generated.prototype.onDragOver = host
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)
    const event = new Event('dragover') as DragEvent

    expect(node.onDragOver?.(event)).toBe(true)
    expect(host).toHaveBeenCalledWith(event)
    expect(extension).toHaveBeenCalledWith(
      comfy.graph.node(String(node.id)),
      event
    )
  })

  it('leaves a drop with the first handler that claims it', async () => {
    const registry = createDefRegistry()
    const first = vi.fn(async () => false)
    const second = vi.fn(async () => true)
    const skipped = vi.fn(async () => true)
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => {
        b.onDrop(first)
        b.onDrop(second)
        b.onDrop(skipped)
      })
    const Generated = nodeClass('KSampler')
    const host = vi.fn(async () => false)
    Generated.prototype.onDragDrop = host
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)
    const event = new Event('drop') as DragEvent

    await expect(node.onDragDrop?.(event)).resolves.toBe(true)
    expect(host).toHaveBeenCalledWith(event)
    expect(first).toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
    expect(skipped).not.toHaveBeenCalled()
  })

  it('does not replay a drop the host already handled', async () => {
    const registry = createDefRegistry()
    const extension = vi.fn(async () => true)
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('KSampler', (b) => b.onDrop(extension))
    const Generated = nodeClass('KSampler')
    Generated.prototype.onDragDrop = vi.fn(async () => true)
    registry.applyTo(Generated, RAW_DEF)
    const node = new Generated()
    graph.add(node)

    await expect(
      node.onDragDrop?.(new Event('drop') as DragEvent)
    ).resolves.toBe(true)
    expect(extension).not.toHaveBeenCalled()
  })

  it('adds a context menu entry that reaches the node', () => {
    const seen: string[] = []
    const node = build((b) =>
      b.addMenuItem({ label: 'Do it', run: (n) => seen.push(n.id) })
    )
    const options: { content: string; callback: () => void }[] = []
    node.getExtraMenuOptions?.(undefined as never, options as never)
    expect(options.map((o) => o.content)).toContain('Do it')
    options.find((o) => o.content === 'Do it')!.callback()
    expect(seen).toEqual([String(node.id)])
  })

  it('hides an entry whose predicate says no', () => {
    // efficiency-nodes hides its seed submenu when the feature is off.
    // Without a predicate a pack must show the entry always or never.
    const node = build((b) => {
      b.addMenuItem({ label: 'Shown', when: () => true, run: () => {} })
      b.addMenuItem({ label: 'Hidden', when: () => false, run: () => {} })
    })
    const options: { content: string }[] = []
    node.getExtraMenuOptions?.(undefined as never, options as never)

    const labels = options.map((o) => o.content)
    expect(labels).toContain('Shown')
    expect(labels).not.toContain('Hidden')
  })

  it('computes a label from the node when given a function', () => {
    const node = build((b) =>
      b.addMenuItem({ label: (n) => `Act on ${n.id}`, run: () => {} })
    )
    const options: { content: string }[] = []
    node.getExtraMenuOptions?.(undefined as never, options as never)

    expect(options.map((o) => o.content)).toContain(`Act on ${node.id}`)
  })

  it('computes submenu children per open, from the node as it is now', () => {
    // efficiency-nodes' LoRA Stacker declares 50 lora_name_N widgets and lists
    // only the ones a user filled. A fixed array would be a different menu.
    const node = build((b) =>
      b.addMenuItem({
        label: 'Loaded',
        items: (n) =>
          n.widgets
            .all()
            .filter((w) => w.getValue() !== 'None')
            .map((w) => ({ label: w.name, run: () => {} }))
      })
    )
    const handle = comfy.graph.node(String(node.id))!
    const values = ['None', 'sharp.safetensors']
    handle.widgets.add({
      type: 'combo',
      name: 'lora_1',
      value: 'None',
      options: { values }
    })
    handle.widgets.add({
      type: 'combo',
      name: 'lora_2',
      value: 'None',
      options: { values }
    })

    // Nothing filled yet: an entry opening an empty submenu is a dead end,
    // so it is omitted rather than shown as a no-op.
    const first: { content: string }[] = []
    node.getExtraMenuOptions?.(undefined as never, first as never)
    expect(first.map((o) => o.content)).not.toContain('Loaded')

    handle.widgets.get('lora_2')!.setValue('sharp.safetensors')

    const second: {
      content: string
      submenu?: { options: { content: string }[] }
    }[] = []
    node.getExtraMenuOptions?.(undefined as never, second as never)
    expect(
      second
        .find((o) => o.content === 'Loaded')
        ?.submenu?.options.map((o) => o.content)
    ).toEqual(['lora_2'])
  })

  it('orders entries by `order`, not by module load sequence', () => {
    const node = build((b) => {
      b.addMenuItem({ label: 'Third', order: 30, run: () => {} })
      b.addMenuItem({ label: 'First', order: 10, run: () => {} })
      b.addMenuItem({ label: 'Second', order: 20, run: () => {} })
    })
    const options: { content: string }[] = []
    node.getExtraMenuOptions?.(undefined as never, options as never)

    expect(options.map((o) => o.content)).toEqual(['First', 'Second', 'Third'])
  })

  it('builds a submenu whose children reach the node', () => {
    const seen: string[] = []
    const node = build((b) =>
      b.addMenuItem({
        label: 'Swap with',
        items: [
          { label: 'KSampler', run: (n) => seen.push(`k:${n.id}`) },
          { label: 'Loader', run: (n) => seen.push(`l:${n.id}`) }
        ]
      })
    )
    const options: {
      content: string
      has_submenu?: boolean
      submenu?: { options: { content: string; callback: () => void }[] }
    }[] = []
    node.getExtraMenuOptions?.(undefined as never, options as never)

    const entry = options.find((o) => o.content === 'Swap with')!
    expect(entry.has_submenu).toBe(true)
    expect(entry.submenu?.options.map((o) => o.content)).toEqual([
      'KSampler',
      'Loader'
    ])

    entry.submenu!.options[1].callback()
    expect(seen).toEqual([`l:${node.id}`])
  })
})

describe('renaming a definition', () => {
  // setTitle/setCategory used to update only the registry's own mirror. The
  // host builds its node class from the raw def *after* applyTo returns and
  // assigns node.title from it, so a pack renaming a type saw nothing happen.
  // The translation pack (191K installs) is entirely this.
  it('writes the title back to the raw def the host registers from', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    defs.extend('KSampler', (b) => b.setTitle('Sampler (translated)'))

    const raw: Record<string, unknown> = {
      name: 'KSampler',
      display_name: 'KSampler',
      category: 'sampling'
    }
    registry.applyTo({ prototype: {} }, raw)

    expect(raw.display_name).toBe('Sampler (translated)')
  })

  it('writes the category back too', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    defs.extend('KSampler', (b) => b.setCategory('translated/sampling'))

    const raw: Record<string, unknown> = {
      name: 'KSampler',
      display_name: 'KSampler',
      category: 'sampling'
    }
    registry.applyTo({ prototype: {} }, raw)

    expect(raw.category).toBe('translated/sampling')
  })

  it('leaves the raw def alone when nothing renamed it', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    defs.extend('KSampler', (b) => b.onCreated(() => {}))

    const raw: Record<string, unknown> = {
      name: 'KSampler',
      display_name: 'KSampler',
      category: 'sampling'
    }
    registry.applyTo({ prototype: {} }, raw)

    expect(raw.display_name).toBe('KSampler')
    expect(raw.category).toBe('sampling')
  })
})

describe('marking an existing type frontend-only', () => {
  // A pack that reaches for `node.isVirtualNode` on a BACKEND-registered type
  // is saying "this never runs on the server". graphToPrompt skips virtual
  // nodes, so dropping that line during conversion puts a new node into the
  // prompt -- a wire-format break. `define` could say it; `extend` could not.
  it('sets the flag graphToPrompt checks', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    defs.extend('CompositorTools3', (b) => b.setExecution('frontend'))

    const nodeType: { prototype: Partial<LGraphNode> } = { prototype: {} }
    registry.applyTo(nodeType, { name: 'CompositorTools3' })

    expect(nodeType.prototype.isVirtualNode).toBe(true)
  })

  it('leaves a backend node alone', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    defs.extend('KSampler', (b) => b.onCreated(() => {}))

    const nodeType: { prototype: Partial<LGraphNode> } = { prototype: {} }
    registry.applyTo(nodeType, { name: 'KSampler' })

    expect(nodeType.prototype.isVirtualNode).toBeUndefined()
  })

  it('registers a resolver when one is supplied', () => {
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    const resolve = () => ({ '0': { omit: true } }) as never
    defs.extend('Passthrough', (b) => b.setExecution('frontend', resolve))

    registry.applyTo({ prototype: {} }, { name: 'Passthrough' })

    expect(frontendResolverMap().get('Passthrough')).toBe(resolve)
  })
})

describe('selecting definitions by shape', () => {
  it('matches on a predicate when a name cannot express the guard', () => {
    // "any node taking a VAE input" is a shape, not a name.
    const registry = createDefRegistry()
    const defs = registry.forMajor(() => ({}) as never)
    const seen: string[] = []
    defs.extend(
      (def) => def.inputs.some((i) => i.type === 'VAE'),
      (b) => seen.push(b.def.type)
    )

    registry.applyTo(
      { prototype: {} },
      { name: 'VAEDecode', input: { required: { samples: ['VAE', {}] } } }
    )
    registry.applyTo(
      { prototype: {} },
      { name: 'KSampler', input: { required: { seed: ['INT', {}] } } }
    )

    expect(seen).toEqual(['VAEDecode'])
  })
})
