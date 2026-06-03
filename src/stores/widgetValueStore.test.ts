import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/utils/uuid'
import { asGraphId, nodeEntityId, widgetEntityId } from '@/world/entityIds'
import type { WidgetEntityId } from '@/world/entityIds'

import type { WidgetState } from './widgetValueStore'
import { useWidgetValueStore } from './widgetValueStore'

function widgetState<T>(
  type: string,
  value: T,
  extra: Partial<Omit<WidgetState<T>, 'type' | 'value'>> = {}
): WidgetState<T> {
  return {
    type,
    value,
    options: {},
    ...extra
  }
}

describe('useWidgetValueStore', () => {
  const graphA = 'graph-a' as UUID
  const graphB = 'graph-b' as UUID
  const wid = (graphId: UUID, nodeId: NodeId, name: string): WidgetEntityId =>
    widgetEntityId(asGraphId(graphId), nodeId, name)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('widgetState.value access', () => {
    it('getWidget returns undefined for unregistered widget', () => {
      const store = useWidgetValueStore()
      expect(
        store.getWidget(wid(graphA, 'missing' as NodeId, 'widget'))
      ).toBeUndefined()
    })

    it('widgetState.value can be read and written directly', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      const state = store.registerWidget(id, widgetState('number', 100))
      expect(state.value).toBe(100)

      state.value = 200
      expect(store.getWidget(id)?.value).toBe(200)
    })

    it('stores different value types', () => {
      const store = useWidgetValueStore()
      const node = 'node-1' as NodeId
      store.registerWidget(
        wid(graphA, node, 'text'),
        widgetState('string', 'hello')
      )
      store.registerWidget(
        wid(graphA, node, 'number'),
        widgetState('number', 42)
      )
      store.registerWidget(
        wid(graphA, node, 'boolean'),
        widgetState('toggle', true)
      )
      store.registerWidget(
        wid(graphA, node, 'array'),
        widgetState('combo', [1, 2, 3])
      )

      expect(store.getWidget(wid(graphA, node, 'text'))?.value).toBe('hello')
      expect(store.getWidget(wid(graphA, node, 'number'))?.value).toBe(42)
      expect(store.getWidget(wid(graphA, node, 'boolean'))?.value).toBe(true)
      expect(store.getWidget(wid(graphA, node, 'array'))?.value).toEqual([
        1, 2, 3
      ])
    })
  })

  describe('widget registration', () => {
    it('registers a widget with minimal properties', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget(
        wid(graphA, 'node-1' as NodeId, 'seed'),
        widgetState('number', 12345)
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
        wid(graphA, 'node-1' as NodeId, 'prompt'),
        widgetState('string', 'test', {
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

    it('overwrites existing widget state when registerWidget is called twice', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      const first = store.registerWidget(id, widgetState('number', 11))
      first.value = 99

      store.registerWidget(id, widgetState('number', 11))
      expect(store.getWidget(id)?.value).toBe(11)
    })

    it('register-if-absent pattern preserves existing state', () => {
      // Captures the idempotency guarantee that the prior IO helper used to
      // provide: callers that want non-destructive init must check getWidget
      // first.
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      store.registerWidget(id, widgetState('number', 11))
      const first = store.getWidget(id)!
      first.value = 99

      const existing = store.getWidget(id)
      if (!existing) store.registerWidget(id, widgetState('number', 11))

      expect(store.getWidget(id)?.value).toBe(99)
    })
  })

  describe('widget getters', () => {
    it('getWidget returns widget state', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      store.registerWidget(id, widgetState('number', 100))

      const state = store.getWidget(id)
      expect(state).toBeDefined()
      expect(state?.type).toBe('number')
      expect(state?.value).toBe(100)
    })

    it('getWidget returns undefined for missing widget', () => {
      const store = useWidgetValueStore()
      expect(
        store.getWidget(wid(graphA, 'missing' as NodeId, 'widget'))
      ).toBeUndefined()
    })

    it('getNodeWidgets returns all widgets for a node', () => {
      const store = useWidgetValueStore()
      const node1 = 'node-1' as NodeId
      const node2 = 'node-2' as NodeId
      store.registerWidget(wid(graphA, node1, 'seed'), widgetState('number', 1))
      store.registerWidget(
        wid(graphA, node1, 'steps'),
        widgetState('number', 20)
      )
      store.registerWidget(wid(graphA, node2, 'cfg'), widgetState('number', 7))

      const widgets = store.getNodeWidgets(
        nodeEntityId(asGraphId(graphA), node1)
      )
      expect(widgets).toHaveLength(2)
    })
  })

  describe('direct property mutation', () => {
    it('disabled can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      const state = store.registerWidget(id, widgetState('number', 100))

      state.disabled = true
      expect(store.getWidget(id)?.disabled).toBe(true)
    })

    it('label can be set directly via getWidget', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      const state = store.registerWidget(id, widgetState('number', 100))

      state.label = 'Random Seed'
      expect(store.getWidget(id)?.label).toBe('Random Seed')

      state.label = undefined
      expect(store.getWidget(id)?.label).toBeUndefined()
    })
  })

  describe('graph isolation', () => {
    it('isolates widget states by graph', () => {
      const store = useWidgetValueStore()
      const node = 'node-1' as NodeId
      store.registerWidget(wid(graphA, node, 'seed'), widgetState('number', 1))
      store.registerWidget(wid(graphB, node, 'seed'), widgetState('number', 2))

      expect(store.getWidget(wid(graphA, node, 'seed'))?.value).toBe(1)
      expect(store.getWidget(wid(graphB, node, 'seed'))?.value).toBe(2)
    })

    it('clearGraph only removes one graph namespace', () => {
      const store = useWidgetValueStore()
      const node = 'node-1' as NodeId
      store.registerWidget(wid(graphA, node, 'seed'), widgetState('number', 1))
      store.registerWidget(wid(graphB, node, 'seed'), widgetState('number', 2))

      store.clearGraph(graphA)

      expect(store.getWidget(wid(graphA, node, 'seed'))).toBeUndefined()
      expect(store.getWidget(wid(graphB, node, 'seed'))?.value).toBe(2)
    })
  })

  describe('returned state identity', () => {
    const node = 'node-1' as NodeId
    const widgetId = wid(graphA, node, 'seed')

    it('getWidget returns the same reference as registerWidget', () => {
      const store = useWidgetValueStore()
      const registered = store.registerWidget(
        widgetId,
        widgetState('number', 100)
      )
      expect(store.getWidget(widgetId)).toBe(registered)
    })

    it('cached references detach safely after clearGraph', () => {
      const store = useWidgetValueStore()
      const view = store.registerWidget(widgetId, widgetState('number', 100))
      store.clearGraph(graphA)
      view.value = 999
      view.label = 'ignored'
      view.disabled = true
      expect(store.getWidget(widgetId)).toBeUndefined()
    })
  })

  describe('getNodeWidgetsByName', () => {
    it('returns empty map when node has no widgets', () => {
      const store = useWidgetValueStore()
      const map = store.getNodeWidgetsByName(
        nodeEntityId(asGraphId(graphA), 'no-such' as NodeId)
      )
      expect(map.size).toBe(0)
    })

    it('returns map keyed by widget name', () => {
      const store = useWidgetValueStore()
      const node = 'node-1' as NodeId
      store.registerWidget(wid(graphA, node, 'seed'), widgetState('number', 1))
      store.registerWidget(wid(graphA, node, 'cfg'), widgetState('number', 7))
      const map = store.getNodeWidgetsByName(
        nodeEntityId(asGraphId(graphA), node)
      )
      expect(map.size).toBe(2)
      expect(map.get('seed')?.value).toBe(1)
      expect(map.get('cfg')?.value).toBe(7)
      expect(map.get('missing')).toBeUndefined()
    })
  })

  describe('setValue', () => {
    it('updates an existing widget value and returns true', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      store.registerWidget(id, widgetState('number', 1))
      expect(store.setValue(id, 99)).toBe(true)
      expect(store.getWidget(id)?.value).toBe(99)
    })

    it('returns false when setting value on an unregistered widget', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      expect(store.setValue(id, 99)).toBe(false)
    })
  })

  describe('reactivity through the view', () => {
    it('clearGraph removes data; subsequent getWidget returns undefined', () => {
      const store = useWidgetValueStore()
      const id = wid(graphA, 'node-1' as NodeId, 'seed')
      store.registerWidget(id, widgetState('number', 100))
      store.clearGraph(graphA)
      expect(store.getWidget(id)).toBeUndefined()
    })
  })
})
