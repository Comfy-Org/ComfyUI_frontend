import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { UUID } from '@/utils/uuid'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
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

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('widgetState.value access', () => {
    it('getWidget returns undefined for unregistered widget', () => {
      const store = useWidgetValueStore()
      expect(store.getWidget(seedA)).toBeUndefined()
    })

    it('widgetState.value can be read and written directly', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))
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
      const registered = store.registerWidget(seedA, state('number', 12345))

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
      )

      expect(registered.y).toBe(42)
    })

    it('registerWidget is idempotent and does not overwrite existing state', () => {
      const store = useWidgetValueStore()
      const first = store.registerWidget(seedA, state('number', 11))
      first.value = 99

      const second = store.registerWidget(seedA, state('number', 11))
      expect(second).toBe(first)
      expect(second.value).toBe(99)
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
      )

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

    it('getNodeWidgets returns all widgets for a node', () => {
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
      expect(widgets).toHaveLength(2)
      expect(widgets.map((w) => w.name).sort()).toEqual(['seed', 'steps'])
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

    it('deleteWidget removes registered widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget(seedA, state('number', 100))

      expect(store.deleteWidget(seedA)).toBe(true)
      expect(store.getWidget(seedA)).toBeUndefined()
      expect(store.deleteWidget(seedA)).toBe(false)
    })
  })

  describe('direct property mutation', () => {
    it('disabled can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))

      registered.disabled = true
      expect(store.getWidget(seedA)?.disabled).toBe(true)
    })

    it('label can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(seedA, state('number', 100))

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
  })
})
