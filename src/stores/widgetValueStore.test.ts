import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { WidgetState } from './widgetValueStore'
import { useWidgetValueStore } from './widgetValueStore'

function widget<T>(
  nodeId: string,
  name: string,
  type: string,
  value: T,
  extra: Partial<
    Omit<WidgetState<T>, 'nodeId' | 'name' | 'type' | 'value'>
  > = {}
): WidgetState<T> {
  return { nodeId, name, type, value, options: {}, ...extra }
}

describe('useWidgetValueStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('widgetState.value access', () => {
    it('getWidget returns undefined for unregistered widget', () => {
      const store = useWidgetValueStore()
      expect(store.getWidget('missing', 'widget')).toBeUndefined()
    })

    it('widgetState.value can be read and written directly', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'seed', 'number', 100)
      )
      expect(state.value).toBe(100)

      state.value = 200
      expect(store.getWidget('node-1', 'seed')?.value).toBe(200)
    })

    it('stores different value types', () => {
      const store = useWidgetValueStore()
      store.registerWidget(widget('node-1', 'text', 'string', 'hello'))
      store.registerWidget(widget('node-1', 'number', 'number', 42))
      store.registerWidget(widget('node-1', 'boolean', 'toggle', true))
      store.registerWidget(widget('node-1', 'array', 'combo', [1, 2, 3]))

      expect(store.getWidget('node-1', 'text')?.value).toBe('hello')
      expect(store.getWidget('node-1', 'number')?.value).toBe(42)
      expect(store.getWidget('node-1', 'boolean')?.value).toBe(true)
      expect(store.getWidget('node-1', 'array')?.value).toEqual([1, 2, 3])
    })
  })

  describe('widget registration', () => {
    it('registers a widget with minimal properties', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'seed', 'number', 12345)
      )

      expect(state.nodeId).toBe('node-1')
      expect(state.name).toBe('seed')
      expect(state.type).toBe('number')
      expect(state.value).toBe(12345)
      expect(state.disabled).toBeUndefined()
      expect(state.promoted).toBeUndefined()
      expect(state.serialize).toBeUndefined()
      expect(state.options).toEqual({})
    })

    it('registers a widget with all properties', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'prompt', 'string', 'test', {
          label: 'Prompt Text',
          disabled: true,
          promoted: true,
          serialize: false,
          options: { multiline: true }
        })
      )

      expect(state.label).toBe('Prompt Text')
      expect(state.disabled).toBe(true)
      expect(state.promoted).toBe(true)
      expect(state.serialize).toBe(false)
      expect(state.options).toEqual({ multiline: true })
    })
  })

  describe('widget getters', () => {
    it('getWidget returns widget state', () => {
      const store = useWidgetValueStore()
      store.registerWidget(widget('node-1', 'seed', 'number', 100))

      const state = store.getWidget('node-1', 'seed')
      expect(state).toBeDefined()
      expect(state?.name).toBe('seed')
      expect(state?.value).toBe(100)
    })

    it('getWidget returns undefined for missing widget', () => {
      const store = useWidgetValueStore()
      expect(store.getWidget('missing', 'widget')).toBeUndefined()
    })

    it('getNodeWidgets returns all widgets for a node', () => {
      const store = useWidgetValueStore()
      store.registerWidget(widget('node-1', 'seed', 'number', 1))
      store.registerWidget(widget('node-1', 'steps', 'number', 20))
      store.registerWidget(widget('node-2', 'cfg', 'number', 7))

      const widgets = store.getNodeWidgets('node-1')
      expect(widgets).toHaveLength(2)
      expect(widgets.map((w) => w.name).sort()).toEqual(['seed', 'steps'])
    })
  })

  describe('direct property mutation', () => {
    it('disabled can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'seed', 'number', 100)
      )

      state.disabled = true
      expect(store.getWidget('node-1', 'seed')?.disabled).toBe(true)
    })

    it('promoted can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'seed', 'number', 100)
      )

      state.promoted = true
      expect(store.getWidget('node-1', 'seed')?.promoted).toBe(true)
    })

    it('label can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        widget('node-1', 'seed', 'number', 100)
      )

      state.label = 'Random Seed'
      expect(store.getWidget('node-1', 'seed')?.label).toBe('Random Seed')

      state.label = undefined
      expect(store.getWidget('node-1', 'seed')?.label).toBeUndefined()
    })
  })
})
