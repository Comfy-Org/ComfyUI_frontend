import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { parseWidgetId } from '@/types/widgetId'

import { ComfyApiError, ComfyReadonlyError } from './errors'
import { createWidgetCollection, createWidgetHandles } from './widgetHandle'
import type { WidgetCollection } from './widgetHandle'

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
