import { describe, expect, it, vi } from 'vitest'

import type { UUID } from '@/utils/uuid'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'

import { useWidgetValueStore } from './widgetValueStore'

function state<T>(
  type: string,
  value: T,
  extra: Partial<Omit<WidgetState<T>, 'type' | 'value'>> = {}
): Omit<WidgetState<T>, 'nodeId' | 'name' | 'y'> & { y?: number } {
  return { type, value, options: {}, ...extra }
}

describe('useWidgetValueStore', () => {
  const graphA = 'graph-a' as UUID
  const graphB = 'graph-b' as UUID
  const seedA = widgetId(graphA, toNodeId('node-1'), 'seed')
  const seedB = widgetId(graphB, toNodeId('node-1'), 'seed')

  describe('widgetState.value access', () => {
    it('getWidget returns undefined for unregistered widget', () => {
      const store = useWidgetValueStore()
      expect(store.getWidget(seedA)).toBeUndefined()
    })

    it('does not create state while reading missing widgets', () => {
      const store = useWidgetValueStore()
      const onMutation = vi.fn()
      store.$subscribe(onMutation, { flush: 'sync' })

      expect(store.getWidget(seedA)).toBeUndefined()
      expect(store.getWidgetRenderState(seedA)).toBeUndefined()
      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([])

      expect(onMutation).not.toHaveBeenCalled()
    })

    it('widgetState.value can be read and written directly', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))!
      expect(registered.value).toBe(100)

      registered.value = 200
      expect(store.getWidget(seedA)?.value).toBe(200)
    })

    it('stores different value types', () => {
      const store = useWidgetValueStore()
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'text'),
        state('string', 'hello')
      )
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'number'),
        state('number', 42)
      )
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'boolean'),
        state('toggle', true)
      )
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'array'),
        state('combo', [1, 2, 3])
      )

      expect(
        store.getWidget(widgetId(graphA, toNodeId('node-1'), 'text'))?.value
      ).toBe('hello')
      expect(
        store.getWidget(widgetId(graphA, toNodeId('node-1'), 'number'))?.value
      ).toBe(42)
      expect(
        store.getWidget(widgetId(graphA, toNodeId('node-1'), 'boolean'))?.value
      ).toBe(true)
      expect(
        store.getWidget(widgetId(graphA, toNodeId('node-1'), 'array'))?.value
      ).toEqual([1, 2, 3])
    })
  })

  describe('widget registration', () => {
    it('registers a widget with minimal properties', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 12345))!

      expect(registered.nodeId).toBe('node-1')
      expect(registered.name).toBe('seed')
      expect(registered.type).toBe('number')
      expect(registered.value).toBe(12345)
      expect(registered.disabled).toBeUndefined()
      expect(registered.serialize).toBeUndefined()
      expect(registered.options).toEqual({})
      expect(registered.y).toBe(0)
    })

    it('registers explicit widget layout y', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(
        seedA,
        state('number', 12345, { y: 42 })
      )!

      expect(registered.y).toBe(42)
    })

    it('refreshes metadata without overwriting the current value', () => {
      const store = useWidgetValueStore()
      const first = store.registerWidget(seedA, state('number', 11))!
      first.value = 99

      const second = store.registerWidget(
        seedA,
        state('number', 11, {
          label: 'Updated seed',
          options: { min: 4 },
          disabled: true
        })
      )!
      expect(second).toBe(first)
      expect(second.value).toBe(99)
      expect(second.label).toBe('Updated seed')
      expect(second.options).toEqual({ min: 4 })
      expect(second.disabled).toBe(true)
    })

    it('replaces a stale entry when the widget type changes', () => {
      const store = useWidgetValueStore()
      const first = store.registerWidget(seedA, state('number', 5))!
      first.value = 42

      // After a subgraph convert the graphId:nodeId:name key can be reused by a
      // different widget. A type mismatch means it is not the same widget, so
      // the live type/value must win rather than the stale entry (BUG: a text
      // widget rendered as int until reload).
      const reconciled = store.registerWidget(seedA, state('string', 'hello'))!
      expect(reconciled.type).toBe('string')
      expect(reconciled.value).toBe('hello')
      expect(store.getWidget(seedA)?.type).toBe('string')
    })

    it('does not accept caller-owned identity during re-registration', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 5))
      const stale = state('number', 10, { name: 'wrong' })
      Object.assign(stale, { nodeId: toNodeId('wrong') })

      const registered = store.registerWidget(seedA, stale)!

      expect(registered.nodeId).toBe(toNodeId('node-1'))
      expect(registered.name).toBe('wrong')
    })

    it('clears omitted render state when a widget id is recycled', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 5), {
        advanced: true,
        tooltip: 'old'
      })

      store.registerWidget(seedA, state('string', 'new'))

      expect(store.getWidgetRenderState(seedA)).toEqual({})
    })

    it('registers a widget with all properties', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(
        seedA,
        state('string', 'test', {
          label: 'Prompt Text',
          disabled: true,
          serialize: false,
          options: { multiline: true }
        })
      )!

      expect(registered.label).toBe('Prompt Text')
      expect(registered.disabled).toBe(true)
      expect(registered.serialize).toBe(false)
      expect(registered.options).toEqual({ multiline: true })
    })
  })

  describe('widget getters', () => {
    it('getWidget returns widget state', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 100))

      const registered = store.getWidget(seedA)
      expect(registered).toBeDefined()
      expect(registered?.name).toBe('seed')
      expect(registered?.value).toBe(100)
    })

    it('getNodeWidgets returns widgets in registration order', () => {
      const store = useWidgetValueStore()
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'seed'),
        state('number', 1)
      )
      store.registerWidget(
        widgetId(graphA, toNodeId('node-1'), 'steps'),
        state('number', 20)
      )
      store.registerWidget(
        widgetId(graphA, toNodeId('node-2'), 'cfg'),
        state('number', 7)
      )

      const widgets = store.getNodeWidgets(graphA, toNodeId('node-1'))
      expect(widgets.map((w) => w.name)).toEqual(['seed', 'steps'])
    })

    it('getNodeWidgetIds returns the explicit node widget order', () => {
      const store = useWidgetValueStore()
      const seed = widgetId(graphA, toNodeId('node-1'), 'seed')
      const steps = widgetId(graphA, toNodeId('node-1'), 'steps')
      const cfg = widgetId(graphA, toNodeId('node-1'), 'cfg')
      store.registerWidget(seed, state('number', 1))
      store.registerWidget(steps, state('number', 20))
      store.registerWidget(cfg, state('number', 7))

      store.setNodeWidgetOrder(graphA, toNodeId('node-1'), [cfg, seed])

      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([
        cfg,
        seed,
        steps
      ])
      expect(
        store.getNodeWidgets(graphA, toNodeId('node-1')).map((w) => w.name)
      ).toEqual(['cfg', 'seed', 'steps'])
    })

    it('ignores widget IDs from other nodes when setting order', () => {
      const store = useWidgetValueStore()
      const seed = widgetId(graphA, toNodeId('node-1'), 'seed')
      const other = widgetId(graphA, toNodeId('node-2'), 'cfg')
      store.registerWidget(seed, state('number', 1))
      store.registerWidget(other, state('number', 7))

      store.setNodeWidgetOrder(graphA, toNodeId('node-1'), [other, seed])

      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([seed])
    })

    it('replaces order using retained widget state', () => {
      const store = useWidgetValueStore()
      const seed = widgetId(graphA, toNodeId('node-1'), 'seed')
      const steps = widgetId(graphA, toNodeId('node-1'), 'steps')
      store.registerWidget(seed, state('number', 1))
      store.registerWidget(steps, state('number', 20))
      store.removeNodeWidgetOrder(seed)

      store.replaceNodeWidgetOrder(graphA, toNodeId('node-1'), [seed])

      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([seed])
      expect(store.getWidget(steps)?.value).toBe(20)
    })
  })

  describe('widget rename', () => {
    it('rejects an occupied destination without changing either widget', () => {
      const store = useWidgetValueStore()
      const nodeId = toNodeId('node-1')
      const steps = widgetId(graphA, nodeId, 'steps')
      const seedState = store.registerWidget(seedA, state('number', 1), {
        tooltip: 'seed'
      })
      const stepsState = store.registerWidget(steps, state('number', 20), {
        tooltip: 'steps'
      })
      const seedRenderState = store.getWidgetRenderState(seedA)
      const stepsRenderState = store.getWidgetRenderState(steps)

      expect(store.renameWidget(seedA, steps)).toBeUndefined()
      expect(store.getWidget(seedA)).toBe(seedState)
      expect(store.getWidget(steps)).toBe(stepsState)
      expect(store.getWidgetRenderState(seedA)).toBe(seedRenderState)
      expect(store.getWidgetRenderState(steps)).toBe(stepsRenderState)
      expect(store.getNodeWidgetIds(graphA, nodeId)).toEqual([seedA, steps])
    })

    it.for([
      {
        name: 'an invalid destination',
        oldId: seedA,
        newId: widgetId('', toNodeId('node-1'), 'renamed')
      },
      {
        name: 'a destination in another graph',
        oldId: seedA,
        newId: widgetId(graphB, toNodeId('node-1'), 'renamed')
      },
      {
        name: 'a destination on another node',
        oldId: seedA,
        newId: widgetId(graphA, toNodeId('node-2'), 'renamed')
      },
      {
        name: 'a missing source',
        oldId: widgetId(graphA, toNodeId('node-1'), 'missing'),
        newId: widgetId(graphA, toNodeId('node-1'), 'renamed')
      }
    ])('leaves sibling state unchanged for $name', ({ oldId, newId }) => {
      const store = useWidgetValueStore()
      const nodeId = toNodeId('node-1')
      const seedState = store.registerWidget(seedA, state('number', 1), {
        tooltip: 'seed'
      })
      const seedRenderState = store.getWidgetRenderState(seedA)

      expect(store.renameWidget(oldId, newId)).toBeUndefined()
      expect(store.getWidget(seedA)).toBe(seedState)
      expect(store.getWidgetRenderState(seedA)).toBe(seedRenderState)
      expect(store.getNodeWidgetIds(graphA, nodeId)).toEqual([seedA])
    })
  })

  describe('value mutation', () => {
    it('setValue updates registered widgets and reports missing widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 100))

      expect(store.setValue(seedA, 200)).toBe(true)
      expect(store.getWidget(seedA)?.value).toBe(200)
      expect(
        store.setValue(widgetId(graphA, toNodeId('missing'), 'seed'), 1)
      ).toBe(false)
    })

    it('updateOptions preserves existing options and reports missing widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget(
        seedA,
        state('number', 100, { options: { min: 0, max: 10 } })
      )

      expect(store.updateOptions(seedA, { advanced: true })).toBe(true)
      expect(store.getWidget(seedA)?.options).toEqual({
        min: 0,
        max: 10,
        advanced: true
      })
      expect(
        store.updateOptions(widgetId(graphA, toNodeId('missing'), 'seed'), {})
      ).toBe(false)
    })

    it('deleteWidget removes registered widgets from node order', () => {
      const store = useWidgetValueStore()
      const steps = widgetId(graphA, toNodeId('node-1'), 'steps')
      store.registerWidget(seedA, state('number', 100))
      store.registerWidget(steps, state('number', 20))

      expect(store.deleteWidget(seedA)).toBe(true)
      expect(store.getWidget(seedA)).toBeUndefined()
      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([
        steps
      ])
      expect(store.deleteWidget(seedA)).toBe(false)
    })

    it('removeNodeWidgetOrder drops the id from order but keeps its value', () => {
      const store = useWidgetValueStore()
      const steps = widgetId(graphA, toNodeId('node-1'), 'steps')
      store.registerWidget(seedA, state('number', 100))
      store.registerWidget(steps, state('number', 20))

      store.removeNodeWidgetOrder(seedA)

      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([
        steps
      ])
      expect(store.getWidget(seedA)?.value).toBe(100)
    })
  })

  describe('direct property mutation', () => {
    it('disabled can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))!

      registered.disabled = true
      expect(store.getWidget(seedA)?.disabled).toBe(true)
    })

    it('label can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))!

      registered.label = 'Random Seed'
      expect(store.getWidget(seedA)?.label).toBe('Random Seed')

      registered.label = undefined
      expect(store.getWidget(seedA)?.label).toBeUndefined()
    })
  })

  describe('graph isolation', () => {
    it('isolates widget states by graph', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 1))
      store.registerWidget(seedB, state('number', 2))

      expect(store.getWidget(seedA)?.value).toBe(1)
      expect(store.getWidget(seedB)?.value).toBe(2)
    })

    it('clearGraph only removes one graph namespace', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 1))
      store.registerWidget(seedB, state('number', 2))

      store.clearGraph(graphA)

      expect(store.getWidget(seedA)).toBeUndefined()
      expect(store.getWidget(seedB)?.value).toBe(2)
    })

    it('clearNode removes only the target node values, render state, and order', () => {
      const store = useWidgetValueStore()
      const sibling = widgetId(graphA, toNodeId('node-2'), 'seed')
      store.registerWidget(seedA, state('number', 1), { advanced: true })
      store.registerWidget(sibling, state('number', 2))

      store.clearNode(graphA, toNodeId('node-1'))

      expect(store.getWidget(seedA)).toBeUndefined()
      expect(store.getWidgetRenderState(seedA)).toBeUndefined()
      expect(store.getNodeWidgetIds(graphA, toNodeId('node-1'))).toEqual([])
      expect(store.getWidget(sibling)?.value).toBe(2)
    })
  })

  describe('un-keyable widget ids', () => {
    // A custom node can register a widget with an empty/malformed name (spacer,
    // header, preview, button). Such an id cannot be keyed; the store must
    // decline it rather than throw and blank every widget on the node.
    const malformedIds = [
      widgetId(graphA, toNodeId('node-1'), '') as WidgetId, // empty name
      'no-colons' as WidgetId,
      `${graphA}:node-1` as WidgetId, // missing name segment
      `${graphA}:node-1:seed:extra` as WidgetId, // extra segment
      `:node-1:seed` as WidgetId, // empty graphId
      `${graphA}::seed` as WidgetId // empty nodeId
    ]

    it('registerWidget declines every un-keyable id instead of throwing', () => {
      const store = useWidgetValueStore()
      for (const id of malformedIds) {
        expect(() =>
          store.registerWidget(id, state('button', null))
        ).not.toThrow()
        expect(store.registerWidget(id, state('button', null))).toBeUndefined()
      }
    })

    it('read, update, and delete operations tolerate un-keyable ids', () => {
      const store = useWidgetValueStore()
      for (const id of malformedIds) {
        expect(store.getWidget(id)).toBeUndefined()
        expect(store.getWidgetRenderState(id)).toBeUndefined()
        expect(store.setValue(id, 1)).toBe(false)
        expect(store.deleteWidget(id)).toBe(false)
      }
    })

    it('declined operations never disturb a valid sibling on the same node', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 7))

      for (const id of malformedIds) {
        store.registerWidget(id, state('button', null))
        store.setValue(id, 999)
        store.deleteWidget(id)
      }

      expect(store.getWidget(seedA)?.value).toBe(7)
      expect(store.setValue(seedA, 8)).toBe(true)
      expect(store.getWidget(seedA)?.value).toBe(8)
    })
  })
})
