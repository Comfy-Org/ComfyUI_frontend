import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'

import { createComfyApi } from './comfyApi'
import type { Comfy } from './comfyApi'
import { createDefRegistry, deliverPreview } from './defsRegistry'
import type { DefSelector, NodeDefBuilder } from './defsRegistry'

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
        { name: 'seed', type: 'INT' },
        { name: 'mode', type: 'COMBO' },
        { name: 'model', type: 'MODEL' }
      ])
      expect(def.outputs).toEqual([{ name: 'LATENT', type: 'LATENT' }])
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
    expect(comfy.supports('widgets.create')).toBe(true)
    expect(comfy.supports('serialization.control')).toBe(true)
    expect(() => comfy.require('defs.extend')).not.toThrow()
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
})
