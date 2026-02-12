import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { WidgetState } from './widgetValueStore'
import { stripGraphPrefix, useWidgetValueStore } from './widgetValueStore'

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

function mockWidget(name: string, type = 'number'): IBaseWidget {
  return { name, type } as IBaseWidget
}

function mockNode(id: string, widgets: IBaseWidget[] = []): LGraphNode {
  return { id, widgets } as unknown as LGraphNode
}

function mockSubgraph(nodes: LGraphNode[]): LGraph {
  const nodeMap = new Map(nodes.map((n) => [String(n.id), n]))
  return {
    getNodeById: (id: string | number | null | undefined) =>
      id != null ? (nodeMap.get(String(id)) ?? null) : null
  } as unknown as LGraph
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

  describe('resolvePromotedWidget', () => {
    it('returns null for missing node', () => {
      const store = useWidgetValueStore()
      const subgraph = mockSubgraph([])

      expect(store.resolvePromotedWidget(subgraph, '99', 'seed')).toBeNull()
    })

    it('returns null for missing widget on existing node', () => {
      const store = useWidgetValueStore()
      const node = mockNode('42', [mockWidget('steps')])
      const subgraph = mockSubgraph([node])
      store.registerWidget(widget('42', 'steps', 'number', 20))

      expect(store.resolvePromotedWidget(subgraph, '42', 'seed')).toBeNull()
    })

    it('returns null when widget exists on node but not in store', () => {
      const store = useWidgetValueStore()
      const w = mockWidget('seed')
      const node = mockNode('42', [w])
      const subgraph = mockSubgraph([node])

      expect(store.resolvePromotedWidget(subgraph, '42', 'seed')).toBeNull()
    })

    it('returns correct state, widget, and node for registered widget', () => {
      const store = useWidgetValueStore()
      const w = mockWidget('seed')
      const node = mockNode('42', [w])
      const subgraph = mockSubgraph([node])
      const registeredState = store.registerWidget(
        widget('42', 'seed', 'number', 12345)
      )

      const result = store.resolvePromotedWidget(subgraph, '42', 'seed')

      expect(result).not.toBeNull()
      expect(result!.state).toBe(registeredState)
      expect(result!.widget).toBe(w)
      expect(result!.node).toBe(node)
    })

    it('state.value matches the store value (same reference)', () => {
      const store = useWidgetValueStore()
      const w = mockWidget('seed')
      const node = mockNode('42', [w])
      const subgraph = mockSubgraph([node])
      store.registerWidget(widget('42', 'seed', 'number', 100))

      const result = store.resolvePromotedWidget(subgraph, '42', 'seed')
      expect(result!.state.value).toBe(100)

      result!.state.value = 200
      expect(store.getWidget('42', 'seed')?.value).toBe(200)
    })

    it('handles stripGraphPrefix for scoped node IDs', () => {
      const store = useWidgetValueStore()
      const w = mockWidget('cfg')
      const node = mockNode('7', [w])
      const subgraph = mockSubgraph([node])
      store.registerWidget(widget('7', 'cfg', 'number', 7.5))

      // nodeId passed as bare '7' resolves to store key '7:cfg'
      const result = store.resolvePromotedWidget(subgraph, '7', 'cfg')
      expect(result).not.toBeNull()
      expect(result!.state.value).toBe(7.5)
    })
  })

  describe('stripGraphPrefix', () => {
    it('strips single prefix', () => {
      expect(stripGraphPrefix('graph1:42')).toBe('42')
    })

    it('strips multiple prefixes', () => {
      expect(stripGraphPrefix('graph1:subgraph2:42')).toBe('42')
    })

    it('returns bare id unchanged', () => {
      expect(stripGraphPrefix('42')).toBe('42')
    })

    it('handles numeric input', () => {
      expect(stripGraphPrefix(42 as unknown as string)).toBe('42')
    })
  })
})
