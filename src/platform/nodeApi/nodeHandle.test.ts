import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { ComfyDeletedError, ComfyReadonlyError } from './errors'
import { createGraphApi } from './graphHandle'
import { createNodeHandles } from './nodeHandle'
import type { NodeHandle } from './nodeHandle'

describe('NodeHandle', () => {
  let graph: LGraph
  let node: LGraphNode
  let handles: ReturnType<typeof createNodeHandles>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('Test Title', 'TestNode')
    graph.add(node)
    handles = createNodeHandles(() => graph, {
      inputs: () => createGraphApi(() => graph).node(String(node.id))!.inputs,
      outputs: () => createGraphApi(() => graph).node(String(node.id))!.outputs,
      widgets: () => createGraphApi(() => graph).node(String(node.id))!.widgets
    })
  })

  const handle = () => handles.handleFor(String(node.id)) as NodeHandle

  describe('reads', () => {
    it('exposes identity and title', () => {
      expect(handle().id).toBe(String(node.id))
      expect(handle().type).toBe('TestNode')
      expect(handle().getTitle()).toBe('Test Title')
    })

    it('reads comfyClass as a string, not a bound method', () => {
      // Registered as a method it read back as a function, so every
      // `switch (node.comfyClass)` in a converted pack fell through in silence.
      ;(node as unknown as { comfyClass: string }).comfyClass = 'INTConstant'
      expect(handle().comfyClass).toBe('INTConstant')
    })

    it('falls back to the node type when there is no comfyClass', () => {
      expect(handle().comfyClass).toBe('TestNode')
    })

    it('maps internal mode enum to public strings', () => {
      expect(handle().getMode()).toBe('always')
      node.mode = LGraphEventMode.BYPASS
      expect(handle().getMode()).toBe('bypass')
    })

    it('reports flags as booleans, not undefined', () => {
      expect(handle().isCollapsed()).toBe(false)
      expect(handle().isPinned()).toBe(false)
    })

    it('returns frozen geometry so reads cannot be written through', () => {
      node.pos = [10, 20]
      const pos = handle().getPosition()
      expect(pos).toEqual({ x: 10, y: 20 })
      expect(Object.isFrozen(pos)).toBe(true)
    })
  })

  describe('geometry the renderer owns', () => {
    // These replace `comfy.constants`, which handed packs slotHeight and
    // titleHeight so they could re-derive geometry themselves. Every use of it
    // was a pack reimplementing hit-testing or slot layout, and getting it
    // wrong for anything but the default vertical stack.
    it('reports bounds including the title bar, not just the body', () => {
      node.pos = [100, 200]
      node.size = [140, 80]

      const bounds = handle().getBounds()

      expect(bounds.x).toBe(100)
      // The body starts at pos.y; the rectangle starts above it.
      expect(bounds.y).toBeLessThan(200)
      expect(bounds.width).toBeGreaterThanOrEqual(140)
      expect(bounds.height).toBeGreaterThan(80)
      expect(Object.isFrozen(bounds)).toBe(true)
    })

    it('answers slot positions from the renderer', () => {
      node.addInput('model', 'MODEL')
      node.addOutput('latent', 'LATENT')

      const input = handle().getSlotPosition('input', 0)
      const output = handle().getSlotPosition('output', 0)

      expect(input).toBeDefined()
      expect(output).toBeDefined()
      // An input sits on the left edge, an output on the right.
      expect(input!.x).toBeLessThan(output!.x)
    })

    it('reports where the node is on screen, accounting for zoom', () => {
      // Packs anchoring a floating panel to a node were reading the viewport's
      // pan and zoom and doing this arithmetic themselves.
      const canvasEl = document.createElement('canvas')
      canvasEl.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect
      const fake = {
        canvas: canvasEl,
        ds: { scale: 2, offset: [10, 20] }
      } as unknown as typeof LGraphCanvas.active_canvas
      const previous = LGraphCanvas.active_canvas
      LGraphCanvas.active_canvas = fake

      try {
        node.pos = [100, 200]
        node.size = [140, 80]
        const graph = handle().getBounds()
        const screen = handle().getScreenRect()!

        expect(screen.x).toBe((graph.x + 10) * 2 + 100)
        expect(screen.y).toBe((graph.y + 20) * 2 + 50)
        // Scale is recoverable without publishing it.
        expect(screen.width / graph.width).toBe(2)
      } finally {
        LGraphCanvas.active_canvas = previous
      }
    })

    it('returns undefined when there is nothing on screen', () => {
      const previous = LGraphCanvas.active_canvas
      LGraphCanvas.active_canvas = undefined as never
      try {
        expect(handle().getScreenRect()).toBeUndefined()
      } finally {
        LGraphCanvas.active_canvas = previous
      }
    })

    it('returns undefined for a slot that does not exist', () => {
      expect(handle().getSlotPosition('input', 9)).toBeUndefined()
    })
  })

  describe('writes', () => {
    it('writes title through to the node', () => {
      handle().setTitle('Renamed')
      expect(node.getTitle()).toBe('Renamed')
    })

    it('commits properties through the node property path', () => {
      node.properties['amount'] = 1
      const widget = node.addWidget('number', 'amount', 1, () => {}, {
        property: 'amount'
      })
      node.onPropertyChanged = vi.fn()

      handle().setProperty('amount', 7)

      expect(node.onPropertyChanged).toHaveBeenCalledWith('amount', 7, 1)
      expect(widget.value).toBe(7)
    })

    it('maps public mode strings back to the internal enum', () => {
      handle().setMode('never')
      expect(node.mode).toBe(LGraphEventMode.NEVER)
    })

    it('rejects an invalid mode loudly instead of silently ignoring', () => {
      expect(() => {
        handle().setMode('nonsense' as never)
      }).toThrow(/Invalid node mode/)
      expect(node.mode).toBe(LGraphEventMode.ALWAYS)
    })

    it('sets flags without clobbering sibling flags', () => {
      node.flags = { ...node.flags, pinned: true }
      handle().setCollapsed(true)
      expect(node.flags.collapsed).toBe(true)
      expect(node.flags.pinned).toBe(true)
    })

    it('round-trips shape through public names', () => {
      handle().setShape('card')
      expect(handle().getShape()).toBe('card')
    })

    it('rejects an invalid shape', () => {
      expect(() => {
        handle().setShape('hexagon' as never)
      }).toThrow(/Invalid node shape/)
    })

    it('reports an unmapped internal shape as default', () => {
      // `configure` can restore ARROW, GRID or HollowCircle from a saved
      // workflow. Those have no public name, and the lookup returned undefined
      // where the contract promises a NodeShape.
      node.shape = RenderShape.ARROW

      expect(handle().getShape()).toBe('default')
      expect(handle().snapshot()?.shape).toBe('default')
    })

    it('rejects a shape name inherited from Object.prototype', () => {
      expect(() => {
        handle().setShape('constructor' as never)
      }).toThrow(/Invalid node shape/)
      expect(node.shape).toBeUndefined()
    })

    it('refuses to change type, pointing at the replacement', () => {
      expect(() => {
        ;(handle() as { type: string }).type = 'Other'
      }).toThrow(ComfyReadonlyError)
      expect(() => {
        ;(handle() as { type: string }).type = 'Other'
      }).toThrow(/no published way to change it/)
      expect(node.type).toBe('TestNode')
    })

    it('re-declaring constraints replaces them rather than stacking', () => {
      // The hook used to be chained on every call, each closure holding the
      // constraints it was built with — so an updated maximum fought the old
      // one instead of replacing it. Crystools calls this on every populate.
      handle().setSizeConstraints({ minWidth: 400 })
      handle().setSizeConstraints({ minWidth: 100 })

      node.size = [120, 80]
      node.onResize?.(node.size)

      expect(node.size[0]).toBe(120)
    })

    it('keeps constraints with the node, not with its id', () => {
      const other = new LGraphNode('Other', 'TestNode')
      const otherGraph = new LGraph()
      other.id = node.id
      otherGraph.add(other)

      handle().setSizeConstraints({ minWidth: 400 })

      const otherHandles = createNodeHandles(() => otherGraph, {
        inputs: () =>
          createGraphApi(() => otherGraph).node(String(other.id))!.inputs,
        outputs: () =>
          createGraphApi(() => otherGraph).node(String(other.id))!.outputs,
        widgets: () =>
          createGraphApi(() => otherGraph).node(String(other.id))!.widgets
      })
      const otherHandle = otherHandles.handleFor(String(other.id)) as NodeHandle

      expect(otherHandle.getSizeConstraints()).toEqual({})
    })

    it('installs the resize hook once, however often it is declared', () => {
      handle().setSizeConstraints({ minWidth: 50 })
      const hook = node.onResize
      handle().setSizeConstraints({ minWidth: 60 })

      expect(node.onResize).toBe(hook)
    })

    it('moves and resizes via methods', () => {
      handle().setPosition({ x: 100, y: 200 })
      handle().setSize({ width: 300, height: 400 })
      expect([node.pos[0], node.pos[1]]).toEqual([100, 200])
      expect([node.size[0], node.size[1]]).toEqual([300, 400])
    })

    it('runs the node resize protocol when setting its size', () => {
      const onResize = vi.fn()
      node.onResize = onResize

      handle().setSize({ width: 300, height: 400 })

      expect([...onResize.mock.calls[0][0]]).toEqual([300, 400])
    })
  })

  describe('the real node is not reachable', () => {
    it('does not expose litegraph internals', () => {
      const h = handle() as unknown as Record<string, unknown>
      expect(h.graph).toBeUndefined()
      expect(h._state).toBeUndefined()
      expect(h.flags).toBeUndefined()
      expect(h.constructor).toBeUndefined()
      expect(Object.getPrototypeOf(h)).toBeNull()
    })

    it('exposes widgets as a closed collection, not the raw array', () => {
      const widgets = handle().widgets
      expect(Array.isArray(widgets)).toBe(false)
      expect(widgets).not.toBe(node.widgets)
      expect(typeof widgets.reorder).toBe('function')
    })

    it('has no property path from the handle to the LGraphNode', () => {
      const seen = new Set<unknown>()
      const reaches = (value: unknown, depth: number): boolean => {
        if (depth > 4 || value === null || typeof value !== 'object') {
          return false
        }
        if (value === node || value === graph) return true
        if (seen.has(value)) return false
        seen.add(value)
        return Object.values(value).some((v) => reaches(v, depth + 1))
      }
      expect(reaches(handle(), 0)).toBe(false)
    })

    it('yields an inert, cloneable snapshot', () => {
      const snap = handle().snapshot()
      expect(() => structuredClone(snap)).not.toThrow()
      expect(snap).toMatchObject({ type: 'TestNode', title: 'Test Title' })
    })
  })

  describe('lifetime', () => {
    it('is identity-stable for the same node', () => {
      expect(handle()).toBe(handle())
    })

    it('removes the node from the graph', () => {
      handle().remove()
      expect(graph.nodes).not.toContain(node)
    })

    it('reports isDeleted once the node is gone', () => {
      const held = handle()
      expect(held.isDeleted).toBe(false)
      graph.remove(node)
      expect(held.isDeleted).toBe(true)
    })

    it('keeps reads inert and mutations loud after deletion', () => {
      const held = handle()
      const id = held.id
      graph.remove(node)

      expect(held.id).toBe(id)
      expect(held.getTitle()).toBeUndefined()
      expect(held.getPosition()).toBeUndefined()
      expect(() => held.snapshot()).not.toThrow()
      expect(held.snapshot()).toBeUndefined()
      expect(() => held.setTitle('zombie')).toThrow(ComfyDeletedError)
    })

    it('makes idempotent cleanup on a dead handle harmless', () => {
      const held = handle()
      graph.remove(node)
      // Removing an already-removed node is the caller's desired end state, so
      // packs can run teardown unconditionally.
      expect(() => held.remove()).not.toThrow()
    })

    it('still refuses a write on a dead handle', () => {
      const held = handle()
      graph.remove(node)
      // A dropped write is a bug the pack cannot see. Setting is not
      // idempotent, so unlike removal it has to be loud.
      expect(() => held.setPosition({ x: 1, y: 2 })).toThrow(ComfyDeletedError)
      expect(() => held.setTitle('zombie')).toThrow(ComfyDeletedError)
    })

    it('liveHandleFor gates on current existence', () => {
      expect(handles.liveHandleFor(String(node.id))).toBeDefined()
      graph.remove(node)
      expect(handles.liveHandleFor(String(node.id))).toBeUndefined()
    })
  })
})

describe('getOutputImages', () => {
  it('reports the images a node produced, by URL', () => {
    // The point is reading ANOTHER node's outputs: onExecuted is per node type,
    // so a pack never sees what a different pack's node produced.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const producer = new LGraphNode('Producer')
    graph.add(producer)
    const handle = createGraphApi(() => graph).nodes()[0]

    expect(handle.getOutputImages()).toEqual([])

    useNodeOutputStore().setNodeOutputs(producer, ['out.png'], {
      folder: 'output'
    })

    const urls = handle.getOutputImages()
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('out.png')
  })
})

describe('badges', () => {
  it('adds a badge the renderers draw, and removes it again', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('T')
    graph.add(node)
    const handle = createGraphApi(() => graph).nodes()[0]

    const remove = handle.addBadge({ text: '3 loras', bgColor: '#123' })

    expect(node.badges).toHaveLength(1)
    const badge = node.badges[0]
    const drawn = typeof badge === 'function' ? badge() : badge
    expect(drawn.text).toBe('3 loras')
    expect(drawn.bgColor).toBe('#123')

    remove()
    expect(node.badges).toHaveLength(0)
  })

  it('makes a badge clickable when the pack gives it an action', () => {
    // Two conversions declined to turn a button into a badge because a badge
    // that looks pressable and does nothing is worse than what it replaced.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('T')
    graph.add(node)
    const run = vi.fn()

    createGraphApi(() => graph)
      .nodes()[0]
      .addBadge({ text: '?', onClick: run })

    const badge = node.badges[0]
    const drawn = typeof badge === 'function' ? badge() : badge
    drawn.onClick?.(new MouseEvent('click'))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('reports which graph holds the node', () => {
    // Node ids are unique per graph, so a pack keying its own records by id
    // alone collides once subgraphs are involved.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('T')
    graph.add(node)

    expect(createGraphApi(() => graph).nodes()[0].graphId).toBe(graph.id)
  })

  it('re-reads a function badge on every draw', () => {
    // The point of the function form: a count that changes must not need the
    // pack to remove and re-add the badge.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('T')
    graph.add(node)
    let count = 1
    createGraphApi(() => graph)
      .nodes()[0]
      .addBadge(() => ({ text: `${count} item` }))

    const read = () => {
      const b = node.badges[0]
      return (typeof b === 'function' ? b() : b).text
    }
    expect(read()).toBe('1 item')
    count = 7
    expect(read()).toBe('7 item')
  })

  it('reads the object form once, so a reused variable cannot change it', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('T')
    graph.add(node)
    const def = { text: 'before' }
    createGraphApi(() => graph)
      .nodes()[0]
      .addBadge(def)

    def.text = 'after'

    const b = node.badges[0]
    expect((typeof b === 'function' ? b() : b).text).toBe('before')
  })
})
