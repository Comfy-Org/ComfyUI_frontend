import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { asGraphId, widgetEntityId } from '@/world/entityIds'
import { getWorld, resetWorldInstance } from '@/world/worldInstance'

import {
  WidgetComponentDisplay,
  WidgetComponentValue
} from './widgetComponents'
import type { WidgetState } from './widgetValueStore'
import { useWidgetValueStore } from './widgetValueStore'

type WidgetInput<T = unknown> = WidgetState<T> & {
  name: string
  nodeId: NodeId
}

function widget<T>(
  nodeId: string,
  name: string,
  type: string,
  value: T,
  extra: Partial<Omit<WidgetState<T>, 'type' | 'value'>> = {}
): WidgetInput<T> {
  return {
    nodeId: nodeId as NodeId,
    name,
    type,
    value,
    options: {},
    ...extra
  }
}

describe('useWidgetValueStore', () => {
  const graphA = 'graph-a' as UUID
  const graphB = 'graph-b' as UUID
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetWorldInstance()
  })

  describe('widgetState.value access', () => {
    it('getWidget returns undefined for unregistered widget', () => {
      const store = useWidgetValueStore()
      expect(
        store.getWidget(graphA, 'missing' as NodeId, 'widget')
      ).toBeUndefined()
    })

    it('widgetState.value can be read and written directly', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        graphA,
        widget('node-1', 'seed', 'number', 100)
      )
      expect(state.value).toBe(100)

      state.value = 200
      expect(store.getWidget(graphA, 'node-1' as NodeId, 'seed')?.value).toBe(
        200
      )
    })

    it('stores different value types', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'text', 'string', 'hello'))
      store.registerWidget(graphA, widget('node-1', 'number', 'number', 42))
      store.registerWidget(graphA, widget('node-1', 'boolean', 'toggle', true))
      store.registerWidget(
        graphA,
        widget('node-1', 'array', 'combo', [1, 2, 3])
      )

      expect(store.getWidget(graphA, 'node-1' as NodeId, 'text')?.value).toBe(
        'hello'
      )
      expect(store.getWidget(graphA, 'node-1' as NodeId, 'number')?.value).toBe(
        42
      )
      expect(
        store.getWidget(graphA, 'node-1' as NodeId, 'boolean')?.value
      ).toBe(true)
      expect(
        store.getWidget(graphA, 'node-1' as NodeId, 'array')?.value
      ).toEqual([1, 2, 3])
    })
  })

  describe('widget registration', () => {
    it('registers a widget with minimal properties', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        graphA,
        widget('node-1', 'seed', 'number', 12345)
      )

      expect(state.type).toBe('number')
      expect(state.value).toBe(12345)
      expect(state.disabled).toBe(false)
      expect(state.serialize).toBeUndefined()
      expect(state.options).toEqual({})
    })

    it('registers a widget with all properties', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        graphA,
        widget('node-1', 'prompt', 'string', 'test', {
          label: 'Prompt Text',
          disabled: true,
          serialize: false,
          options: { multiline: true }
        })
      )

      expect(state.label).toBe('Prompt Text')
      expect(state.disabled).toBe(true)
      expect(state.serialize).toBe(false)
      expect(state.options).toEqual({ multiline: true })
    })
  })

  describe('widget getters', () => {
    it('getWidget returns widget state', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'seed', 'number', 100))

      const state = store.getWidget(graphA, 'node-1' as NodeId, 'seed')
      expect(state).toBeDefined()
      expect(state?.type).toBe('number')
      expect(state?.value).toBe(100)
    })

    it('getWidget returns undefined for missing widget', () => {
      const store = useWidgetValueStore()
      expect(
        store.getWidget(graphA, 'missing' as NodeId, 'widget')
      ).toBeUndefined()
    })

    it('getNodeWidgets returns all widgets for a node', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'seed', 'number', 1))
      store.registerWidget(graphA, widget('node-1', 'steps', 'number', 20))
      store.registerWidget(graphA, widget('node-2', 'cfg', 'number', 7))

      const widgets = store.getNodeWidgets(graphA, 'node-1' as NodeId)
      expect(widgets).toHaveLength(2)
    })
  })

  describe('direct property mutation', () => {
    it('disabled can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        graphA,
        widget('node-1', 'seed', 'number', 100)
      )

      state.disabled = true
      expect(
        store.getWidget(graphA, 'node-1' as NodeId, 'seed')?.disabled
      ).toBe(true)
    })

    it('label can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        graphA,
        widget('node-1', 'seed', 'number', 100)
      )

      state.label = 'Random Seed'
      expect(store.getWidget(graphA, 'node-1' as NodeId, 'seed')?.label).toBe(
        'Random Seed'
      )

      state.label = undefined
      expect(
        store.getWidget(graphA, 'node-1' as NodeId, 'seed')?.label
      ).toBeUndefined()
    })
  })

  describe('graph isolation', () => {
    it('isolates widget states by graph', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'seed', 'number', 1))
      store.registerWidget(graphB, widget('node-1', 'seed', 'number', 2))

      expect(store.getWidget(graphA, 'node-1' as NodeId, 'seed')?.value).toBe(1)
      expect(store.getWidget(graphB, 'node-1' as NodeId, 'seed')?.value).toBe(2)
    })

    it('clearGraph only removes one graph namespace', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'seed', 'number', 1))
      store.registerWidget(graphB, widget('node-1', 'seed', 'number', 2))

      store.clearGraph(graphA)

      expect(
        store.getWidget(graphA, 'node-1' as NodeId, 'seed')
      ).toBeUndefined()
      expect(store.getWidget(graphB, 'node-1' as NodeId, 'seed')?.value).toBe(2)
    })
  })

  describe('view contract: data semantics, not identity', () => {
    // The view is a delegating accessor object built fresh per call.
    // Identity is intentionally NOT preserved across getWidget calls. See
    // temp/plans/widget-component-decomposition.md §10.4.
    const branded = asGraphId(graphA)
    const sample = widget('node-1', 'seed', 'number', 100)

    it('reads delegate live to the underlying components', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(graphA, sample)
      const widgetId = widgetEntityId(branded, sample.nodeId, sample.name)
      const valueBucket = getWorld().getComponent(
        widgetId,
        WidgetComponentValue
      )
      expect(view.value).toBe(valueBucket?.value)
    })

    it('writes round-trip through the underlying components', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(graphA, sample)
      const widgetId = widgetEntityId(branded, sample.nodeId, sample.name)

      view.value = 42
      expect(
        getWorld().getComponent(widgetId, WidgetComponentValue)?.value
      ).toBe(42)

      view.label = 'hello'
      expect(
        getWorld().getComponent(widgetId, WidgetComponentDisplay)?.label
      ).toBe('hello')

      view.disabled = true
      expect(
        getWorld().getComponent(widgetId, WidgetComponentDisplay)?.disabled
      ).toBe(true)
    })

    it('underlying component writes are visible through the view', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(graphA, sample)
      const widgetId = widgetEntityId(branded, sample.nodeId, sample.name)
      const display = getWorld().getComponent(widgetId, WidgetComponentDisplay)
      if (!display) throw new Error('display bucket missing')
      display.label = 'fresh'
      expect(view.label).toBe('fresh')
    })

    it('setters no-op safely after clearGraph', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(graphA, sample)
      store.clearGraph(graphA)
      // Should not throw. Subsequent getWidget remains undefined.
      view.value = 999
      view.label = 'ignored'
      view.disabled = true
      expect(
        store.getWidget(graphA, sample.nodeId, sample.name)
      ).toBeUndefined()
    })

    it('view properties are enumerable for spread/objectContaining', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(graphA, sample)
      const keys = Object.keys(view).sort()
      expect(keys).toEqual(
        ['disabled', 'label', 'options', 'serialize', 'type', 'value'].sort()
      )
    })
  })

  describe('getNodeWidgetsByName', () => {
    it('returns empty map when node has no widgets', () => {
      const store = useWidgetValueStore()
      const map = store.getNodeWidgetsByName(graphA, 'no-such' as NodeId)
      expect(map.size).toBe(0)
    })

    it('returns map keyed by widget name', () => {
      const store = useWidgetValueStore()
      store.registerWidget(graphA, widget('node-1', 'seed', 'number', 1))
      store.registerWidget(graphA, widget('node-1', 'cfg', 'number', 7))
      const map = store.getNodeWidgetsByName(graphA, 'node-1' as NodeId)
      expect(map.size).toBe(2)
      expect(map.get('seed')?.value).toBe(1)
      expect(map.get('cfg')?.value).toBe(7)
      expect(map.get('missing')).toBeUndefined()
    })
  })

  describe('reactivity through the view', () => {
    it('clearGraph removes data; subsequent getWidget returns undefined', () => {
      const store = useWidgetValueStore()
      const sample = widget('node-1', 'seed', 'number', 100)
      store.registerWidget(graphA, sample)
      store.clearGraph(graphA)
      expect(
        store.getWidget(graphA, sample.nodeId, sample.name)
      ).toBeUndefined()
    })
  })
})
