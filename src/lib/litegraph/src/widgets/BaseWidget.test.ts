import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function createTestWidget(
  node: LGraphNode,
  overrides: Partial<INumericWidget> = {}
): NumberWidget {
  return new NumberWidget(
    {
      type: 'number',
      name: 'testWidget',
      value: 42,
      options: { min: 0, max: 100 },
      y: 0,
      ...overrides
    },
    node
  )
}

describe('BaseWidget store integration', () => {
  let node: LGraphNode
  let store: ReturnType<typeof useWidgetValueStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useWidgetValueStore()
    node = new LGraphNode('TestNode')
    node.id = 1
  })

  describe('metadata properties before registration', () => {
    it('uses internal values when not registered', () => {
      const widget = createTestWidget(node, {
        label: 'My Label',
        hidden: true,
        disabled: true,
        advanced: true,
        promoted: true
      })

      expect(widget.label).toBe('My Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
      expect(widget.promoted).toBe(true)
    })

    it('allows setting properties without store', () => {
      const widget = createTestWidget(node)

      widget.label = 'New Label'
      widget.hidden = true
      widget.disabled = true
      widget.advanced = true
      widget.promoted = true

      expect(widget.label).toBe('New Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
      expect(widget.promoted).toBe(true)
    })
  })

  describe('metadata properties after registration', () => {
    it('reads from store when registered', () => {
      const widget = createTestWidget(node, {
        name: 'storeWidget',
        label: 'Store Label',
        hidden: true,
        disabled: true,
        advanced: true,
        promoted: true
      })
      widget.setNodeId(1)

      expect(widget.label).toBe('Store Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
      expect(widget.promoted).toBe(true)
    })

    it('writes to store when registered', () => {
      const widget = createTestWidget(node, { name: 'writeWidget' })
      widget.setNodeId(1)

      widget.label = 'Updated Label'
      widget.hidden = true
      widget.disabled = true
      widget.advanced = true
      widget.promoted = true

      const state = store.getWidget(1, 'writeWidget')
      expect(state?.label).toBe('Updated Label')
      expect(state?.hidden).toBe(true)
      expect(state?.disabled).toBe(true)
      expect(state?.advanced).toBe(true)
      expect(state?.promoted).toBe(true)
    })

    it('syncs value with store', () => {
      const widget = createTestWidget(node, { name: 'valueWidget', value: 42 })
      widget.setNodeId(1)

      widget.value = 99
      expect(store.getWidget(1, 'valueWidget')?.value).toBe(99)

      const state = store.getWidget(1, 'valueWidget')!
      state.value = 55
      expect(widget.value).toBe(55)
    })
  })

  describe('automatic registration via setNodeId', () => {
    it('registers widget with all metadata', () => {
      const widget = createTestWidget(node, {
        name: 'autoRegWidget',
        value: 100,
        label: 'Auto Label',
        hidden: true,
        disabled: true,
        advanced: true,
        promoted: true
      })
      widget.setNodeId(1)

      const state = store.getWidget(1, 'autoRegWidget')
      expect(state).toBeDefined()
      expect(state?.nodeId).toBe(1)
      expect(state?.name).toBe('autoRegWidget')
      expect(state?.type).toBe('number')
      expect(state?.value).toBe(100)
      expect(state?.label).toBe('Auto Label')
      expect(state?.hidden).toBe(true)
      expect(state?.disabled).toBe(true)
      expect(state?.advanced).toBe(true)
      expect(state?.promoted).toBe(true)
      expect(state?.options).toEqual({ min: 0, max: 100 })
    })

    it('registers widget with default metadata values', () => {
      const widget = createTestWidget(node, { name: 'defaultsWidget' })
      widget.setNodeId(1)

      const state = store.getWidget(1, 'defaultsWidget')
      expect(state).toBeDefined()
      expect(state?.hidden).toBe(false)
      expect(state?.disabled).toBe(false)
      expect(state?.advanced).toBe(false)
      expect(state?.promoted).toBe(false)
      expect(state?.label).toBeUndefined()
    })

    it('registers widget value accessible via getWidget', () => {
      const widget = createTestWidget(node, { name: 'valuesWidget', value: 77 })
      widget.setNodeId(1)

      expect(store.getWidget(1, 'valuesWidget')?.value).toBe(77)
    })
  })

  describe('fallback behavior', () => {
    it('uses internal value before registration', () => {
      const widget = createTestWidget(node, {
        name: 'fallbackWidget',
        label: 'Internal'
      })
      // Widget not yet registered - should use internal value
      expect(widget.label).toBe('Internal')
    })

    it('handles undefined values correctly', () => {
      const widget = createTestWidget(node)
      widget.setNodeId(1)

      widget.hidden = undefined
      widget.disabled = undefined

      const state = store.getWidget(1, 'testWidget')
      expect(state?.hidden).toBe(false)
      expect(state?.disabled).toBe(false)
    })
  })
})
