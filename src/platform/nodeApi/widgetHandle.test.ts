import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
// Installs LGraphNode.prototype.addDOMWidget as a side effect.
import '@/scripts/domWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { parseWidgetId } from '@/types/widgetId'

import { ComfyApiError, ComfyReadonlyError } from './errors'
import { createGraphApi } from './graphHandle'
import { whileEmbeddingWorkflow } from './serializeContext'
import { createWidgetCollection, createWidgetHandles } from './widgetHandle'
import type { WidgetCollection } from './widgetHandle'
import { dispatchWidgetTextInteraction } from './widgetTextInteraction'
import { createWidgetTypeRegistrar } from './widgetTypes'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

describe('widget surface', () => {
  let graph: LGraph
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('Test', 'TestNode')
    graph.add(node)
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('number', 'steps', 20, () => undefined, {})
    node.addWidget('string', 'prompt', 'hello', () => undefined, {})

    const handles = createWidgetHandles(() => graph)
    const nodeId = String(node.id)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      nodeId
    )
  })

  describe('reads', () => {
    it('exposes widgets by name and position', () => {
      expect(widgets.length).toBe(3)
      expect(widgets.get('seed')?.getValue()).toBe(1)
      expect(widgets.at(1)?.name).toBe('steps')
      expect(widgets.names()).toEqual(['seed', 'steps', 'prompt'])
    })

    it('returns undefined for an unknown widget', () => {
      expect(widgets.get('nope')).toBeUndefined()
    })

    it('is iterable', () => {
      expect([...widgets].map((w) => w.name)).toEqual([
        'seed',
        'steps',
        'prompt'
      ])
    })

    it('does not leak the widget instance', () => {
      const handle = widgets.get('seed') as unknown as Record<string, unknown>
      expect(handle.node).toBeUndefined()
      expect(handle.callback).toBeUndefined()
      expect(handle.y).toBeUndefined()
      expect(Object.getPrototypeOf(handle)).toBeNull()
    })

    it('returns frozen options rather than the live object', () => {
      const opts = widgets.get('seed')!.getOptions()
      expect(Object.isFrozen(opts)).toBe(true)
    })
  })

  describe('values', () => {
    it('writes through to the widget', () => {
      widgets.get('seed')!.setValue(42)
      expect(node.widgets![0].value).toBe(42)
    })

    it('refuses to change widget type, pointing at hidden', () => {
      expect(() => {
        ;(widgets.get('seed') as unknown as { widgetType: string }).widgetType =
          'converted-widget'
      }).toThrow(ComfyReadonlyError)
      expect(() => {
        ;(widgets.get('seed') as unknown as { widgetType: string }).widgetType =
          'converted-widget'
      }).toThrow(/setHidden\(true\)/)
    })
  })

  describe('setOptions preserves live accessors', () => {
    // kjnodes defines `values` as a getter for dynamic combos; a spread-based
    // merge would pin it to a one-time snapshot.
    it('keeps a getter a getter', () => {
      let calls = 0
      const w = node.widgets![0]
      const opts = {}
      Object.defineProperty(opts, 'values', {
        get: () => {
          calls++
          return ['a', 'b']
        },
        enumerable: true,
        configurable: true
      })
      w.options = opts as never

      widgets.get('seed')!.setOption('tooltip', 'hi')

      const descriptor = Object.getOwnPropertyDescriptor(
        node.widgets![0].options,
        'values'
      )
      expect(typeof descriptor?.get).toBe('function')
      const before = calls
      void (node.widgets![0].options as { values: string[] }).values
      expect(calls).toBeGreaterThan(before)
    })

    it('merges the patch over existing options', () => {
      widgets.get('seed')!.setOption('tooltip', 'hi')
      widgets.get('seed')!.setOption('step', 2)
      const opts = widgets.get('seed')!.getOptions() as Record<string, unknown>
      expect(opts.tooltip).toBe('hi')
      expect(opts.step).toBe(2)
    })
  })

  describe('hidden replaces the converted-widget hack', () => {
    it('defaults to false and toggles', () => {
      const seed = widgets.get('seed')!
      expect(seed.isHidden()).toBe(false)
      seed.setHidden(true)
      expect(node.widgets![0].hidden).toBe(true)
    })

    it('hides the control widget core attached to it, and unhides both', () => {
      // The legacy hideWidget helper recursed through linkedWidgets. Without
      // the cascade a seed's control_after_generate is left floating where its
      // owner used to be.
      const control = node.widgets![1]
      node.widgets![0].linkedWidgets = [control]
      const seed = widgets.get('seed')!

      seed.setHidden(true)
      expect(control.hidden).toBe(true)

      seed.setHidden(false)
      expect(node.widgets![0].hidden).toBe(false)
      expect(control.hidden).toBe(false)
    })

    it('survives a cycle in the links', () => {
      const control = node.widgets![1]
      node.widgets![0].linkedWidgets = [control]
      control.linkedWidgets = [node.widgets![0]]

      expect(() => widgets.get('seed')!.setHidden(true)).not.toThrow()
      expect(control.hidden).toBe(true)
    })

    it('reads the control widget core attached to the seed', () => {
      // A pack asks a seed's control_after_generate whether it says fixed or
      // randomize to know what the node will do next.
      const control = node.widgets![1]
      control.value = 'randomize'
      node.widgets![0].linkedWidgets = [control]

      const linked = widgets.get('seed')!.linked()

      expect(linked.map((w) => w.name)).toEqual([control.name])
      expect(linked[0].getValue()).toBe('randomize')
    })

    it('reports no linked widgets when core attached none', () => {
      expect(widgets.get('seed')!.linked()).toEqual([])
    })

    it('lets a pack declare controls that hide with its widget', () => {
      const seed = widgets.get('seed')!

      seed.setLinked(['steps', 'prompt'])
      seed.setHidden(true)

      expect(seed.linked().map((widget) => widget.name)).toEqual([
        'steps',
        'prompt'
      ])
      expect(node.widgets!.map((widget) => widget.hidden)).toEqual([
        true,
        true,
        true
      ])
    })

    it('refuses to link a widget that is not on the same node', () => {
      expect(() => widgets.get('seed')!.setLinked(['missing'])).toThrow(
        /No widget named 'missing'/
      )
    })

    it('retains the value while hidden', () => {
      const seed = widgets.get('seed')!
      seed.setValue(7)
      seed.setHidden(true)
      expect(seed.getValue()).toBe(7)
    })
  })

  describe('reorder replaces splice/assign', () => {
    it('reorders widgets', () => {
      widgets.reorder(['prompt', 'seed', 'steps'])
      expect(widgets.names()).toEqual(['prompt', 'seed', 'steps'])
      expect(node.widgets!.map((w) => w.name)).toEqual([
        'prompt',
        'seed',
        'steps'
      ])
    })

    it('mutates the array in place so renderer tracking survives', () => {
      const before = node.widgets
      widgets.reorder(['prompt', 'seed', 'steps'])
      expect(node.widgets).toBe(before)
    })

    it('rejects a partial list instead of silently dropping widgets', () => {
      expect(() => widgets.reorder(['seed'])).toThrow(ComfyApiError)
      expect(() => widgets.reorder(['seed'])).toThrow(/Missing: steps, prompt/)
      expect(widgets.names()).toEqual(['seed', 'steps', 'prompt'])
    })

    it('rejects unknown names', () => {
      expect(() => widgets.reorder(['seed', 'steps', 'ghost'])).toThrow(
        /Unknown: ghost/
      )
    })

    it('syncs the store render order, not just the array', () => {
      // Nodes 2.0 renders from the store order; an array-only reorder is
      // invisible there, which is the half-fix trap.
      const store = useWidgetValueStore()
      const graphId = graph.rootGraph.id
      widgets.reorder(['prompt', 'seed', 'steps'])

      const order = store
        .getNodeWidgetIds(graphId, node.id)
        .map((id) => parseWidgetId(id).name)
      expect(order).toEqual(['prompt', 'seed', 'steps'])
    })

    it('rejects duplicates', () => {
      expect(() => widgets.reorder(['seed', 'seed', 'steps'])).toThrow(
        ComfyApiError
      )
    })
  })

  describe('move', () => {
    it('moves a widget to a new index', () => {
      widgets.move('prompt', 0)
      expect(widgets.names()).toEqual(['prompt', 'seed', 'steps'])
    })

    it('clamps an out-of-range index instead of throwing', () => {
      widgets.move('seed', 99)
      expect(widgets.names()).toEqual(['steps', 'prompt', 'seed'])
    })

    it('throws for an unknown widget', () => {
      expect(() => widgets.move('ghost', 0)).toThrow(/No widget named 'ghost'/)
    })
  })

  describe('removal', () => {
    it('removes a widget and reports success', () => {
      expect(widgets.remove('steps')).toBe(true)
      expect(widgets.names()).toEqual(['seed', 'prompt'])
    })

    it('returns false for an unknown widget', () => {
      expect(widgets.remove('ghost')).toBe(false)
    })

    it('marks a held handle deleted once its widget is gone', () => {
      const held = widgets.get('steps')!
      expect(held.isDeleted).toBe(false)
      widgets.remove('steps')
      expect(held.isDeleted).toBe(true)
      expect(held.getValue()).toBeUndefined()
    })
  })

  describe('when the owning node is deleted', () => {
    it('empties the collection without throwing', () => {
      const held = widgets.get('seed')!
      graph.remove(node)
      expect(widgets.length).toBe(0)
      expect(widgets.names()).toEqual([])
      expect(held.isDeleted).toBe(true)
    })
  })
})

describe('widget listeners', () => {
  let graph: LGraph
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('t')
    node.addWidget('number', 'seed', 1, null, {})
    graph.add(node)
    const handles = createWidgetHandles(() => graph)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      String(node.id)
    )
  })

  it('notifies on a value written through the handle', () => {
    const seen: unknown[] = []
    widgets.get('seed')!.on('change', (v, o) => seen.push([v, o]))
    widgets.get('seed')!.setValue(42)
    expect(seen).toEqual([[42, 1]])
  })

  it('notifies when litegraph invokes the widget callback', () => {
    const seen: unknown[] = []
    widgets.get('seed')!.on('change', (v) => seen.push(v))
    node.widgets![0].callback?.(7)
    expect(seen).toEqual([7])
  })

  it('notifies for a real user edit, where the value is assigned first', () => {
    // Litegraph's own order: `BaseWidget.setValue` writes `this.value` and
    // only then calls `this.callback`. Reading the widget back inside the
    // callback therefore yields the new value as the old one, and every
    // notification was being swallowed as a no-op change. The test above
    // passes without this because it never assigns the value.
    const seen: unknown[] = []
    widgets.get('seed')!.on('change', (v, o) => seen.push([v, o]))

    const widget = node.widgets![0]
    widget.value = 7
    widget.callback?.(7)

    expect(seen).toEqual([[7, 1]])
  })

  it('reports the previous value across consecutive edits', () => {
    const seen: unknown[] = []
    widgets.get('seed')!.on('change', (v, o) => seen.push([v, o]))

    const widget = node.widgets![0]
    for (const value of [2, 3]) {
      widget.value = value
      widget.callback?.(value)
    }

    expect(seen).toEqual([
      [2, 1],
      [3, 2]
    ])
  })

  it('fires activate for a button, whose value never changes', () => {
    // The failure this closes: `widgets.add({type:'button'})` produced a widget
    // no pack could attach an action to, so every converted button was inert.
    const clicks: unknown[] = []
    widgets.add({ type: 'button', name: 'go', value: null })
    widgets.get('go')!.on('activate', (v) => clicks.push(v))

    const button = node.widgets!.find((w) => w.name === 'go')!
    button.callback?.(null as never)
    button.callback?.(null as never)

    expect(clicks).toEqual([null, null])
  })

  it('keeps a null widget value rather than coercing it to empty string', () => {
    // `addWidget('button', name, null, cb)` put null in widgets_values; coercing
    // it changes the saved workflow.
    widgets.add({ type: 'button', name: 'go', value: null })
    expect(node.widgets!.find((w) => w.name === 'go')!.value).toBeNull()
  })

  it('constructs a dynamically added pack-declared widget type', () => {
    const render = vi.fn()
    const graphApi = createGraphApi(() => graph)
    node.serialize_widgets = true
    createWidgetTypeRegistrar((owner) => graphApi.node(String(owner.id))!)(
      'VHSINT',
      { render }
    )

    const added = widgets.add({
      type: 'VHSINT',
      name: 'frame_load_cap',
      value: 12,
      options: { step: 4 }
    })

    expect(render).toHaveBeenCalledOnce()
    expect(added.widgetType).toBe('VHSINT')
    expect(added.getValue()).toBe(12)
    expect(added.getOptions()).toMatchObject({ step: 4, default: 12 })
    expect(node.serialize().widgets_values).toContain(12)
  })

  it('still calls a callback the pack already had', () => {
    const original = vi.fn()
    node.widgets![0].callback = original
    widgets.get('seed')!.on('change', () => {})
    node.widgets![0].callback?.(3)
    expect(original).toHaveBeenCalledWith(3)
  })

  it('runs every listener, so one pack cannot drop another', () => {
    const a = vi.fn()
    const b = vi.fn()
    widgets.get('seed')!.on('change', a)
    widgets.get('seed')!.on('change', b)
    widgets.get('seed')!.setValue(9)
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('does not fire when the value is unchanged', () => {
    const listener = vi.fn()
    widgets.get('seed')!.on('change', listener)
    widgets.get('seed')!.setValue(1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const off = widgets.get('seed')!.on('change', listener)
    off()
    widgets.get('seed')!.setValue(5)
    expect(listener).not.toHaveBeenCalled()
  })

  it('fires removed when the widget is taken off the node', () => {
    const removed = vi.fn()
    widgets.get('seed')!.on('removed', removed)
    widgets.remove('seed')
    expect(removed).toHaveBeenCalledOnce()
  })
})

describe('setValue commits like a user edit', () => {
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    node = new LGraphNode('t')
    node.addWidget('number', 'seed', 1, null, {})
    graph.add(node)
    const handles = createWidgetHandles(() => graph)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      String(node.id)
    )
  })

  it('runs the callback chain the host installed', () => {
    // The corpus idiom `widget.value = x; widget.callback?.(x)` exists because
    // core behavior hangs off the callback — an upload combo repaints its
    // preview there. A write that skips the chain forks the UI from the state.
    const hostCallback = vi.fn()
    node.widgets![0].callback = hostCallback
    widgets.get('seed')!.setValue(5)
    expect(hostCallback).toHaveBeenCalledOnce()
    expect(hostCallback).toHaveBeenCalledWith(
      5,
      undefined,
      node,
      undefined,
      undefined
    )
  })

  it('syncs the node property the widget is bound to', () => {
    node.widgets![0].options.property = 'seedProp'
    node.properties.seedProp = 1
    widgets.get('seed')!.setValue(9)
    expect(node.properties.seedProp).toBe(9)
  })

  it('notifies the node through onWidgetChanged', () => {
    const onWidgetChanged = vi.fn()
    node.onWidgetChanged = onWidgetChanged
    widgets.get('seed')!.setValue(9)
    expect(onWidgetChanged).toHaveBeenCalledWith('seed', 9, 1, node.widgets![0])
  })

  it('does not fire activate, which reports a user act', () => {
    const activated = vi.fn()
    widgets.get('seed')!.on('activate', activated)
    widgets.get('seed')!.setValue(5)
    expect(activated).not.toHaveBeenCalled()

    node.widgets![0].callback?.(6)
    expect(activated).toHaveBeenCalledOnce()
    expect(activated).toHaveBeenCalledWith(6)
  })

  it('keeps activate for a user edit whose handler writes another widget', () => {
    node.addWidget('number', 'steps', 20, null, {})
    const seed = widgets.get('seed')!
    const steps = widgets.get('steps')!
    const seedActivated = vi.fn()
    const stepsActivated = vi.fn()
    seed.on('activate', seedActivated)
    steps.on('activate', stepsActivated)
    seed.on('change', (v) => steps.setValue(v))

    node.widgets![0].callback?.(3)

    expect(seedActivated).toHaveBeenCalledOnce()
    expect(stepsActivated).not.toHaveBeenCalled()
    expect(steps.getValue()).toBe(3)
  })

  it('reports the previous value correctly after a mixed sequence', () => {
    // Before setValue drove the callback chain, its writes never reached the
    // bridge's record of the last value: a user edit reverting a programmatic
    // write compared equal to it and the change was swallowed.
    const seen: unknown[] = []
    widgets.get('seed')!.on('change', (v, o) => seen.push([v, o]))

    widgets.get('seed')!.setValue(5)
    const widget = node.widgets![0]
    widget.value = 1
    widget.callback?.(1)

    expect(seen).toEqual([
      [5, 1],
      [1, 5]
    ])
  })

  it('leaves the chain untouched when the value is unchanged', () => {
    const hostCallback = vi.fn()
    node.widgets![0].callback = hostCallback
    widgets.get('seed')!.setValue(1)
    expect(hostCallback).not.toHaveBeenCalled()
  })

  it('contributes caret-aware behavior without exposing the text element', () => {
    const raw = node.addWidget('custom', 'text', 'emb', () => undefined, {})
    const text = widgets.get('text')!
    const onWidgetChanged = vi.fn()
    const callback = vi.fn()
    const seen = vi.fn((event) => {
      expect(event).not.toHaveProperty('element')
      expect(event.value).toBe('embedding:foo')
      expect(event.selection).toEqual({ start: 9, end: 12 })
      expect(event.menuEvent.clientX).toBe(30)
      expect(event.menuEvent.clientY).toBe(60)
      event.setValue('embedding:bar', { start: 13, end: 13 })
    })
    raw.callback = callback
    node.onWidgetChanged = onWidgetChanged
    text.on('textInteraction', seen)
    const textarea = document.createElement('textarea')
    textarea.value = 'embedding:foo'
    textarea.setSelectionRange(9, 12)
    textarea.getBoundingClientRect = () => ({ left: 20, bottom: 50 }) as DOMRect
    const version = node.graph!._version

    dispatchWidgetTextInteraction(
      raw,
      textarea,
      'input',
      new InputEvent('input')
    )

    expect(seen).toHaveBeenCalledOnce()
    expect(raw.value).toBe('embedding:bar')
    expect(textarea.value).toBe('embedding:bar')
    expect(textarea.selectionStart).toBe(13)
    expect(textarea.selectionEnd).toBe(13)
    expect(callback).toHaveBeenCalledWith(
      'embedding:bar',
      undefined,
      node,
      undefined,
      undefined
    )
    expect(onWidgetChanged).toHaveBeenCalledWith(
      'text',
      'embedding:bar',
      'emb',
      raw
    )
    expect(node.graph!._version).toBe(version + 1)
  })

  it('contributes keyboard behavior to a host text editor', () => {
    const raw = node.addWidget(
      'custom',
      'text',
      '<lora:foo:1.0>',
      () => undefined,
      {}
    )
    const text = widgets.get('text')!
    const textarea = document.createElement('textarea')
    textarea.value = '<lora:foo:1.0>'
    textarea.setSelectionRange(0, textarea.value.length)
    const stopped = vi.fn()
    const focused = vi.spyOn(textarea, 'focus')
    const nextValue = '<lora:foo:1.01>'

    text.on('textInteraction', (event) => {
      if (event.kind !== 'keydown') return
      expect(event.key).toBe('ArrowUp')
      expect(event.ctrlKey).toBe(true)
      expect(event.shiftKey).toBe(true)
      expect(event.metaKey).toBe(false)
      event.setValue(nextValue, { start: 0, end: nextValue.length })
      event.focus()
      event.preventDefault()
      event.stopPropagation()
    })

    const sourceEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true
    })
    sourceEvent.stopPropagation = stopped
    dispatchWidgetTextInteraction(raw, textarea, 'keydown', sourceEvent)

    expect(raw.value).toBe(nextValue)
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(nextValue.length)
    expect(sourceEvent.defaultPrevented).toBe(true)
    expect(stopped).toHaveBeenCalledOnce()
    expect(focused).toHaveBeenCalledOnce()
  })
})

describe('mounted and canvas widgets', () => {
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    node = new LGraphNode('t')
    graph.add(node)
    const handles = createWidgetHandles(() => graph)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      String(node.id)
    )
  })

  it('hands the pack a container it can fill', () => {
    let filled: HTMLElement | undefined
    widgets.mount({
      name: 'panel',
      render: (container) => {
        filled = container
        container.append(document.createElement('span'))
      }
    })
    expect(filled?.querySelector('span')).toBeTruthy()
    expect(widgets.names()).toContain('panel')
  })

  it('lets a mounted widget remain rendered at low zoom', () => {
    widgets.mount({ name: 'default', render: () => {} })
    widgets.mount({ name: 'always', hideOnZoom: false, render: () => {} })

    const mounted = node.widgets as unknown as {
      options: { hideOnZoom?: boolean }
    }[]
    expect(mounted[0].options.hideOnZoom).toBe(true)
    expect(mounted[1].options.hideOnZoom).toBe(false)
  })

  it('keeps a mounted widget out of the saved workflow by default', () => {
    // A pack drawing something must not change what the workflow contains.
    widgets.mount({ name: 'panel', render: () => {} })
    expect(node.widgets?.[0].serialize).toBe(false)
  })

  it('runs destroy when the widget is removed', () => {
    const destroy = vi.fn()
    widgets.mount({ name: 'panel', render: () => {}, destroy })
    widgets.remove('panel')
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('holds a value when the pack declares a default', () => {
    // Without a cell a mounted control keeps its widgets_values slot but has
    // nothing to put in it, so a converted colour picker silently lost what
    // the user chose. This is the root of most of the wire deltas.
    let api: { get(): unknown; set(v: unknown): void } | undefined
    widgets.mount({
      name: 'colour',
      defaultValue: '#000000',
      render: (_c, value) => {
        api = value as never
      }
    })

    expect(node.widgets![0].value).toBe('#000000')
    api!.set('#ff0000')
    expect(node.widgets![0].value).toBe('#ff0000')
    expect(api!.get()).toBe('#ff0000')
  })

  it('serializes a value-holding mount, but not a decoration', () => {
    widgets.mount({ name: 'panel', render: () => {} })
    widgets.mount({ name: 'colour', defaultValue: '#000', render: () => {} })

    expect(node.widgets![0].serialize).toBe(false)
    expect(node.widgets![1].serialize).toBe(true)
  })

  it('can be saved in the workflow without being sent in the prompt', () => {
    // The two flags are distinct in litegraph and one boolean could not say
    // this: a readout the node fills in from its own execution result belongs
    // in the saved workflow, but has no business being an input on the next
    // queue. It is what `addDOMWidget(…, { serialize: false })` did.
    widgets.mount({
      name: 'readout',
      defaultValue: 'shown',
      serialize: true,
      sendToPrompt: false,
      render: () => {}
    })

    const raw = node.widgets![0]
    expect(raw.serialize).toBe(true)
    expect(raw.options.serialize).toBe(false)
  })

  it('tells a value-holding mount when the value changed elsewhere', () => {
    const seen = vi.fn()
    widgets.mount({
      name: 'colour',
      defaultValue: '#000000',
      render: (_c, value) => {
        value.onChange(seen)
      }
    })

    // What a workflow load does.
    node.widgets![0].value = '#abcdef'
    node.widgets![0].callback?.('#abcdef' as never)

    expect(seen).toHaveBeenCalledWith('#abcdef')
  })

  it('gives each mount its own copy of an object default', () => {
    // Packs hoist one default object and pass it to every mount; a control
    // that edits its value in place would edit every node's at once.
    const shared = { points: [1, 2] }
    widgets.mount({ name: 'a', defaultValue: shared, render: () => {} })
    ;(node.widgets![0].value as { points: number[] }).points.push(3)

    expect(shared.points).toEqual([1, 2])
  })

  it('refuses to mount over an existing widget name', () => {
    widgets.mount({ name: 'panel', render: () => {} })
    expect(() => widgets.mount({ name: 'panel', render: () => {} })).toThrow(
      ComfyApiError
    )
  })

  it('runs destroy when the whole node is removed, not just the widget', () => {
    // A mounted element owns document listeners and timers. If teardown only
    // fired on removeWidget, deleting the node would leave them running.
    const destroy = vi.fn()
    widgets.mount({ name: 'panel', render: () => {}, destroy })

    node.graph!.remove(node)

    expect(destroy).toHaveBeenCalledOnce()
  })

  it('still unregisters from the store when the pack supplies destroy', () => {
    // `onRemove` is the method that unregisters a DOM widget from the store.
    // Assigning the pack's teardown over it shadows that method and leaks the
    // widget for the life of the page.
    const store = useDomWidgetStore()
    widgets.mount({ name: 'panel', render: () => {}, destroy: () => {} })
    const mounted = node.widgets![0]
    const { id } = mounted as unknown as { id: string }
    expect(store.widgetStates.get(id)).toBeDefined()

    mounted.onRemove?.()

    expect(store.widgetStates.get(id)).toBeUndefined()
  })

  describe('canvas', () => {
    beforeEach(() => {
      // happy-dom has no 2D context; the drawing itself is the pack's, so a
      // recording stub is enough to prove the wiring.
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () =>
          ({
            setTransform: vi.fn(),
            clearRect: vi.fn(),
            fillRect: vi.fn()
          }) as unknown as CanvasRenderingContext2D
      ) as unknown as HTMLCanvasElement['getContext']
    })

    it('draws on mount and hands back the 2d context', () => {
      const draw = vi.fn()
      widgets.canvas({ name: 'plot', height: 40, draw })
      expect(draw).toHaveBeenCalledOnce()
      const [context, size] = draw.mock.calls[0]
      expect(typeof context.fillRect).toBe('function')
      expect(size[1]).toBe(40)
    })

    it('redraws on demand', () => {
      const draw = vi.fn()
      const plot = widgets.canvas({ name: 'plot', height: 40, draw })
      plot.redraw()
      plot.redraw()
      expect(draw).toHaveBeenCalledTimes(3)
    })

    /** The mounted <canvas>, with a stable rect so coordinates are checkable. */
    function mountedCanvas(def: Record<string, unknown>) {
      widgets.canvas({ name: 'plot', height: 40, draw: () => {}, ...def })
      const mounted = node.widgets![0] as unknown as { element?: HTMLElement }
      const canvas = mounted.element!.querySelector('canvas')!
      canvas.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect
      canvas.setPointerCapture = vi.fn()
      canvas.hasPointerCapture = vi.fn(() => true)
      canvas.releasePointerCapture = vi.fn()
      return canvas
    }

    it('lays out at the height it reserved, whatever the pixel ratio', () => {
      // The backing store is scaled by devicePixelRatio so the drawing is
      // sharp. A <canvas> with no CSS height lays out at its height ATTRIBUTE,
      // so scaling that alone makes the widget render `ratio` times too tall —
      // 600px of chrome for a 300px comparer on any retina display. Worse, the
      // omitted-height path then reads that back through clientHeight and the
      // ResizeObserver drives it up again on every pass.
      const original = globalThis.devicePixelRatio
      Object.defineProperty(globalThis, 'devicePixelRatio', {
        value: 2,
        configurable: true
      })
      try {
        const canvas = mountedCanvas({ height: 300 })

        expect(canvas.style.height).toBe('300px')
        expect(canvas.height).toBe(600)
      } finally {
        Object.defineProperty(globalThis, 'devicePixelRatio', {
          value: original,
          configurable: true
        })
      }
    })

    it('never takes its height from the element it just resized', () => {
      // With no CSS height a <canvas> lays out at its height ATTRIBUTE — the
      // backing store, already multiplied by the pixel ratio. Reading that back
      // grows the widget by `ratio` on every redraw, and the ResizeObserver
      // makes it a loop. The height has to come from the container instead.
      const plot = widgets.canvas({ name: 'free', draw: () => {} })
      const mounted = node.widgets!.at(-1) as unknown as {
        element?: HTMLElement
      }
      const canvas = mounted.element!.querySelector('canvas')!
      Object.defineProperty(canvas, 'clientHeight', {
        get: () => 9999,
        configurable: true
      })

      plot.redraw()

      expect(canvas.height).not.toBe(9999)
      expect(canvas.style.height).not.toBe('9999px')
    })

    it('lets a widget claim the right-click, and only if it asks', () => {
      // Right-click is left alone by default so the node's own menu keeps
      // working over a widget. A lora row that wants Move Up / Remove has to be
      // able to take it — and taking it must stop both the browser menu and the
      // node's, which are suppressed by different calls.
      const onContextMenu = vi.fn()
      const canvas = mountedCanvas({ onContextMenu })
      const claimed = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true
      })
      canvas.dispatchEvent(claimed)

      expect(onContextMenu).toHaveBeenCalledOnce()
      expect(claimed.defaultPrevented).toBe(true)
    })

    it('leaves the right-click alone when the widget does not want it', () => {
      const plain = mountedCanvas({})
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true
      })
      plain.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    })

    it('holds a value, so a drawn control need not be two widgets', () => {
      // Without this a drawn control that stores something is a hidden value
      // widget plus a surface, and two widgets cannot occupy the one position
      // the original had — which moved rgthree's Power Puter chip row below its
      // code box to keep the saved array intact.
      const draw = vi.fn()
      node.serialize_widgets = true
      widgets.canvas({
        name: 'chips',
        height: 40,
        defaultValue: ['LATENT'],
        serialize: true,
        draw
      })

      expect(draw.mock.calls[0][3]?.get()).toEqual(['LATENT'])
      expect(node.serialize().widgets_values).toEqual([['LATENT']])
    })

    it('redraws when the value changes underneath it', () => {
      // A workflow load writes the value with nothing else touching the
      // drawing, which has no other way to notice.
      const draw = vi.fn()
      const plot = widgets.canvas({
        name: 'chips',
        height: 40,
        defaultValue: ['LATENT'],
        draw
      })
      const before = draw.mock.calls.length

      plot.widget.setValue(['IMAGE'])

      expect(draw.mock.calls.length).toBeGreaterThan(before)
      expect(draw.mock.calls.at(-1)![3]?.get()).toEqual(['IMAGE'])
    })

    it('re-reads the theme on every draw, so a switch needs nothing', () => {
      // We told packs to draw; a widget that hardcodes its palette looks wrong
      // the moment the user switches theme, and the alternative they reach for
      // is LiteGraph.WIDGET_BGCOLOR — a renderer constant we intend to delete.
      // Reading at draw time rather than at creation is what makes the switch
      // free: the tokens are inherited, so the element sees the new value.
      const draw = vi.fn()
      const plot = widgets.canvas({ name: 'plot', height: 40, draw })
      const mounted = node.widgets!.at(-1) as unknown as {
        element?: HTMLElement
      }
      const canvas = mounted.element!.querySelector('canvas')!
      // Attached, or there is no computed style to inherit through.
      document.body.append(mounted.element!)

      canvas.style.setProperty('--color-text-primary', 'rgb(1, 2, 3)')
      plot.redraw()

      expect(draw.mock.calls.at(-1)![2]).toMatchObject({ text: 'rgb(1, 2, 3)' })
    })

    it('falls back rather than blanking when a token is missing', () => {
      // A token the design system renames should make a widget slightly wrong,
      // not invisible.
      const draw = vi.fn()
      widgets.canvas({ name: 'plot', height: 40, draw })

      const theme = draw.mock.calls[0][2]
      expect(Object.values(theme).every((v) => !!v)).toBe(true)
    })

    it('reports pointer position in the units draw uses', () => {
      // A hit test written against the drawing has to work unchanged — that is
      // the whole point of keeping the drawing and moving only the surface.
      const onPointerDown = vi.fn()
      const canvas = mountedCanvas({ onPointerDown })

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 130,
          clientY: 70,
          button: 0,
          bubbles: true
        })
      )

      expect(onPointerDown).toHaveBeenCalledOnce()
      expect(onPointerDown.mock.calls[0][0]).toMatchObject({ x: 30, y: 20 })
    })

    it('takes the primary button but leaves middle and right alone', () => {
      // Middle-drag pans the graph and right opens the context menu; both have
      // to keep working over the widget.
      const onPointerDown = vi.fn()
      const canvas = mountedCanvas({ onPointerDown })
      const reachedNode: string[] = []
      canvas.parentElement!.addEventListener('pointerdown', () =>
        reachedNode.push('node')
      )

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, bubbles: true })
      )
      expect(onPointerDown).toHaveBeenCalledTimes(1)
      expect(reachedNode).toEqual([])

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { button: 1, bubbles: true })
      )
      expect(onPointerDown).toHaveBeenCalledTimes(1)
      expect(reachedNode).toEqual(['node'])
    })

    it('captures the pointer so a drag can leave the widget', () => {
      const canvas = mountedCanvas({ onPointerDown: vi.fn() })

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 7,
          bubbles: true
        })
      )

      expect(canvas.setPointerCapture).toHaveBeenCalledWith(7)
    })

    it('mounts a real canvas element, so it renders under both renderers', () => {
      // The legacy renderer positions DOM widgets over the graph canvas and
      // Nodes 2.0 renders them directly; drawing into the shared graph context
      // instead is what would tie the pack to the old renderer.
      widgets.canvas({ name: 'plot', draw: () => {} })
      const mounted = node.widgets![0] as unknown as { element?: HTMLElement }
      const element = mounted.element
      expect(element?.querySelector('canvas')).toBeTruthy()
    })
  })
})

describe('beforeSerialize', () => {
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    node = new LGraphNode('t')
    node.addWidget('number', 'seed', -1, null, {})
    node.serialize_widgets = true
    graph.add(node)
    const handles = createWidgetHandles(() => graph)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      String(node.id)
    )
  })

  const raw = () => node.widgets![0]
  // Mirrors executionUtil: the hook is consulted only when it exists.
  const queued = async () => {
    const w = raw()
    return w.serializeValue ? await w.serializeValue(node, 0) : w.value
  }
  const saved = () => node.serialize().widgets_values?.[0]

  it('leaves both destinations alone when nothing is listening', async () => {
    // Nothing is installed on the widget at all, so a node no pack touched
    // serialises down exactly the path it always did.
    expect(raw().serializeValue).toBeUndefined()
    expect(raw().serializeWorkflowValue).toBeUndefined()
    expect(await queued()).toBe(-1)
    expect(saved()).toBe(-1)
  })

  it('supplies a different value to the prompt without touching the widget', async () => {
    widgets.get('seed')!.on('beforeSerialize', (e) => {
      if (e.context === 'prompt') e.setSerializedValue(12345)
    })

    expect(await queued()).toBe(12345)
    // What the user still sees, and what the workflow still records.
    expect(widgets.get('seed')!.getValue()).toBe(-1)
    expect(saved()).toBe(-1)
  })

  it('supplies a different value to the saved workflow', async () => {
    widgets.get('seed')!.on('beforeSerialize', (e) => {
      if (e.context === 'workflow') e.setSerializedValue(7)
    })

    expect(saved()).toBe(7)
    expect(await queued()).toBe(-1)
  })

  it('hands the handler the value that would have been written', async () => {
    const seen: unknown[] = []
    widgets
      .get('seed')!
      .on('beforeSerialize', (e) => seen.push([e.context, e.value]))

    await queued()
    node.serialize()

    expect(seen).toEqual([
      ['prompt', -1],
      ['workflow', -1]
    ])
  })

  it('omits a value from the prompt when a handler supplies undefined', () => {
    // One pack wrote undefined unless an input was linked. The legacy
    // serializeValue returning undefined left the key set to undefined, which
    // JSON.stringify drops — so "replace with undefined" IS omission, and the
    // wire is identical to what the unconverted pack sent.
    widgets.get('seed')!.on('beforeSerialize', (e) => {
      if (e.context === 'prompt') e.setSerializedValue(undefined)
    })

    return (async () => {
      const widget = node.widgets![0]
      // Exactly what executionUtil does to build one input.
      const value = widget.serializeValue
        ? await widget.serializeValue(node, 0)
        : widget.value
      const inputs: Record<string, unknown> = { seed: value }

      expect(value).toBeUndefined()
      // The key exists but JSON drops it, which is how the legacy path omitted.
      expect('seed' in inputs).toBe(true)
      expect(JSON.parse(JSON.stringify(inputs))).toEqual({})
    })()
  })

  it('tells the embedded copy apart from the saved file', () => {
    // graphToPrompt builds the workflow that travels with the prompt using the
    // very same serialize() a Ctrl+S uses. rgthree's Seed saves -1 but embeds
    // the seed it rolled, so the output PNG reproduces the run.
    const seen: string[] = []
    widgets.get('seed')!.on('beforeSerialize', (e) => {
      seen.push(e.context)
      if (e.context === 'embedded') e.setSerializedValue(4242)
    })

    const saved = node.serialize().widgets_values?.[0]
    const embedded = whileEmbeddingWorkflow(
      () => node.serialize().widgets_values?.[0]
    )

    expect(seen).toEqual(['workflow', 'embedded'])
    expect(saved).toBe(-1)
    expect(embedded).toBe(4242)
  })

  it('stops substituting once the listener is removed', async () => {
    const stop = widgets
      .get('seed')!
      .on('beforeSerialize', (e) => e.setSerializedValue(99))

    expect(await queued()).toBe(99)
    stop()
    expect(await queued()).toBe(-1)
  })
})

describe('setHeight', () => {
  let node: LGraphNode
  let widgets: WidgetCollection

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    node = new LGraphNode('t')
    node.addWidget('number', 'seed', 1, null, {})
    graph.add(node)
    const handles = createWidgetHandles(() => graph)
    widgets = createWidgetCollection(
      () => graph.getNodeById(node.id) ?? undefined,
      handles,
      String(node.id)
    )
  })

  it('makes the node treat the widget as fixed rather than growable', () => {
    // The node divides spare height between widgets with no computeSize.
    expect(node.widgets![0].computeSize).toBeUndefined()

    widgets.get('seed')!.setHeight(48)

    expect(node.widgets![0].computeSize!(200)).toEqual([200, 48])
  })

  it('reads the height the host allocated during layout', () => {
    const seed = widgets.get('seed')!
    expect(seed.getHeight()).toBeUndefined()

    node.arrange()

    expect(seed.getHeight()).toBe(node.widgets![0].computedHeight)
    expect(seed.getHeight()).toBeGreaterThan(0)
  })

  it('refuses a height that is not a usable number', () => {
    expect(() => widgets.get('seed')!.setHeight(Number.NaN)).toThrow()
    expect(() => widgets.get('seed')!.setHeight(-1)).toThrow()
  })
})
