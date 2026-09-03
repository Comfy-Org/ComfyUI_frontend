// oxlint-disable no-misused-spread -- spreading a widget is the compatibility contract under test
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import type {
  DrawWidgetOptions,
  WidgetEventOptions
} from '@/lib/litegraph/src/widgets/BaseWidget'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { isWidgetHidden } from '@/types/widgetVisibility'

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

class MutableTypeWidget extends BaseWidget<IBaseWidget<number>> {
  drawWidget(
    _ctx: CanvasRenderingContext2D,
    _options: DrawWidgetOptions
  ): void {}

  onClick(_options: WidgetEventOptions): void {}
}

function createMutableTypeWidget(
  node: LGraphNode,
  name = 'typeChangedWidget'
): MutableTypeWidget {
  return new MutableTypeWidget(
    {
      type: 'number',
      name,
      value: 42,
      options: { min: 0, max: 100 },
      y: 0
    },
    node
  )
}

describe('BaseWidget store integration', () => {
  let graph: LGraph
  let node: LGraphNode
  let store: ReturnType<typeof useWidgetValueStore>

  beforeEach(() => {
    store = useWidgetValueStore()
    graph = new LGraph()
    node = new LGraphNode('TestNode')
    node.id = toNodeId(1)
    graph.add(node)
  })

  it('preserves name in keys, spread copies, and JSON', () => {
    const widget = createTestWidget(node, { name: 'custom-name' })

    const widgetKeys = Object.keys(widget)
    expect(widgetKeys).toContain('_name')
    expect(widgetKeys).not.toContain('name')
    expect({ ...widget }).toMatchObject({ _name: 'custom-name' })
    expect(JSON.parse(JSON.stringify(widget))).toMatchObject({
      _name: 'custom-name'
    })
  })

  describe('metadata properties before registration', () => {
    it('uses internal values when not registered', () => {
      const widget = createTestWidget(node, {
        label: 'My Label',
        hidden: true,
        disabled: true,
        advanced: true
      })

      expect(widget.label).toBe('My Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
    })

    it('allows setting properties without store', () => {
      const widget = createTestWidget(node)

      widget.label = 'New Label'
      widget.hidden = true
      widget.disabled = true
      widget.advanced = true

      expect(widget.label).toBe('New Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
    })

    it('keeps visibility writes shimmed when options are replaced', () => {
      const widget = createTestWidget(node)

      widget.options = { ...widget.options }
      widget.options.hidden = true
      widget.options.hideInPanel = true
      widget.options.advanced = true

      expect(widget.hidden).toBe(true)
      expect(widget.visibility.display.panel).toBe('never')
      expect(widget.advanced).toBe(true)

      widget.setNodeId(toNodeId(1))
      widget.options = { ...widget.options }
      widget.options.hidden = false
      widget.options.hideInPanel = false
      widget.options.advanced = false

      expect(widget.hidden).toBe(false)
      expect(widget.visibility.display.panel).toBe('shown')
      expect(widget.advanced).toBe(false)
    })

    it('survives self-assignment of the options facade', () => {
      const widget = createTestWidget(node)
      widget.hidden = true

      widget.options = widget.options || {}
      widget.options.read_only = true

      expect(widget.hidden).toBe(true)
      expect(widget.options.read_only).toBe(true)

      widget.options.hidden = false

      expect(widget.hidden).toBe(false)
      expect(isWidgetHidden(widget.visibility)).toBe(false)
    })

    it('resets omitted display tiers when options are replaced', () => {
      const widget = createTestWidget(node)
      widget.options.hidden = true
      widget.options.hideInPanel = true
      widget.options.advanced = true

      widget.options = {}

      expect(widget.hidden).toBe(true)
      expect(widget.visibility.display).toEqual({
        canvas: 'shown',
        vueNode: 'shown',
        panel: 'shown'
      })
    })

    it('supplies shimmed options when constructed without them', () => {
      const widget = new MutableTypeWidget(
        fromPartial({
          type: 'GHOST',
          name: 'ghost',
          value: 0,
          y: 0
        }),
        node
      )

      expect(widget.options.hidden).toBe(false)

      widget.options.hidden = true

      expect(widget.hidden).toBe(true)
    })

    it('keeps options.hidden component-driven when an extension shadows the hidden accessor', () => {
      const widget = createTestWidget(node)

      Object.defineProperty(widget, 'hidden', {
        configurable: true,
        get: () => true,
        set: () => {}
      })

      expect(widget.hidden).toBe(true)
      expect(widget.options.hidden).toBe(false)
      expect(widget.visibility.suppression.byExtension).toBe(false)
    })

    it('keeps legacy visibility options observable', () => {
      const widget = createTestWidget(node)

      widget.options.hidden = true
      expect(widget.options.hidden).toBe(true)
      expect({ ...widget.options }).toMatchObject({ hidden: true })

      delete widget.options.hidden
      expect(widget.options.hidden).toBe(false)
    })

    it('keeps options.hidden scoped to extension writes under connection suppression', () => {
      const widget = createTestWidget(node)

      widget.connectionSuppressed = true

      expect(widget.hidden).toBe(true)
      expect(widget.options.hidden).toBe(false)
    })

    it('clearing runtime advanced preserves registration advanced tiers', () => {
      const widget = createTestWidget(node, {
        options: { min: 0, max: 100, advanced: true }
      })

      widget.advanced = true
      expect(widget.visibility.display.canvas).toBe('advanced')

      widget.advanced = undefined
      expect(widget.visibility.display).toEqual({
        canvas: 'shown',
        vueNode: 'advanced',
        panel: 'advanced'
      })
    })
  })

  describe('metadata properties after registration', () => {
    it('reads from store when registered', () => {
      const widget = createTestWidget(node, {
        name: 'storeWidget',
        label: 'Store Label',
        hidden: true,
        disabled: true,
        advanced: true
      })
      widget.setNodeId(toNodeId(1))

      expect(widget.label).toBe('Store Label')
      expect(widget.hidden).toBe(true)
      expect(widget.disabled).toBe(true)
      expect(widget.advanced).toBe(true)
    })

    it('writes to store when registered', () => {
      const widget = node.addWidget(
        'number',
        'writeWidget',
        42,
        () => undefined,
        {}
      )

      widget.label = 'Updated Label'
      widget.hidden = true
      widget.disabled = true
      widget.advanced = true

      const state = store.getWidget(
        widgetId(graph.id, toNodeId(1), 'writeWidget')
      )
      expect(state?.label).toBe('Updated Label')
      expect(state?.options.hidden).toBe(true)
      expect(state?.disabled).toBe(true)

      widget.hidden = false

      expect(state?.options.hidden).toBe(false)
      expect(widget.hidden).toBe(false)
      expect(widget.advanced).toBe(true)
    })

    it('maps legacy visibility APIs to the visibility component', () => {
      const widget = createMutableTypeWidget(node, 'visibleWidget')
      widget.setNodeId(toNodeId(1))
      const id = widgetId(graph.id, toNodeId(1), 'visibleWidget')

      const visibility = () => {
        const component = store.getWidgetVisibility(id)
        return component && isWidgetHidden(component)
      }

      widget.options.hidden = true
      expect(visibility()).toBe(true)
      expect(widget.hidden).toBe(true)

      widget.hidden = false
      expect(visibility()).toBe(false)
      expect(widget.options.hidden).toBe(false)

      widget.type = 'smZhidden'
      expect(visibility()).toBe(true)
      widget.type = 'number'
      expect(visibility()).toBe(false)

      widget.options.hideInPanel = true
      expect(store.getWidgetVisibility(id)?.display.panel).toBe('never')
      delete widget.options.hideInPanel
      expect(store.getWidgetVisibility(id)?.display.panel).toBe('shown')
    })

    it('clears stale hidden state when a converted widget is restored', () => {
      const widget = createMutableTypeWidget(node, 'convertedWidget')
      widget.setNodeId(toNodeId(1))

      widget.type = 'converted-widget'
      widget.hidden = true
      widget.type = 'number'

      expect(widget.hidden).toBe(false)
    })

    it('restoring a converted widget keeps registration hidden state', () => {
      const widget = createMutableTypeWidget(node, 'hiddenConvertedWidget')
      widget.setNodeId(toNodeId(1))

      widget.options.hidden = true
      widget.type = 'converted-widget'
      widget.type = 'number'

      expect(widget.hidden).toBe(true)
      expect(widget.options.hidden).toBe(true)
    })

    it('syncs value with store', () => {
      const widget = createTestWidget(node, { name: 'valueWidget', value: 42 })
      widget.setNodeId(toNodeId(1))

      widget.value = 99
      expect(
        store.getWidget(widgetId(graph.id, toNodeId(1), 'valueWidget'))?.value
      ).toBe(99)

      const state = store.getWidget(
        widgetId(graph.id, toNodeId(1), 'valueWidget')
      )!
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
        advanced: true
      })
      widget.setNodeId(toNodeId(1))

      const state = store.getWidget(
        widgetId(graph.id, toNodeId(1), 'autoRegWidget')
      )
      expect(state).toBeDefined()
      expect(state?.nodeId).toBe('1')
      expect(state?.name).toBe('autoRegWidget')
      expect(state?.type).toBe('number')
      expect(state?.value).toBe(100)
      expect(state?.label).toBe('Auto Label')
      expect(state?.disabled).toBe(true)
      expect(state?.options).toEqual({ min: 0, max: 100, hidden: true })

      expect(widget.hidden).toBe(true)
      expect(widget.advanced).toBe(true)
    })

    it('registers widget with default metadata values', () => {
      const widget = createTestWidget(node, { name: 'defaultsWidget' })
      widget.setNodeId(toNodeId(1))

      const state = store.getWidget(
        widgetId(graph.id, toNodeId(1), 'defaultsWidget')
      )
      expect(state).toBeDefined()
      expect(state?.disabled).toBe(false)
      expect(state?.label).toBeUndefined()

      expect(widget.hidden).toBe(false)
      expect(widget.advanced).toBe(false)
    })

    it('registers widget value accessible via getWidget', () => {
      const widget = createTestWidget(node, { name: 'valuesWidget', value: 77 })
      widget.setNodeId(toNodeId(1))

      expect(
        store.getWidget(widgetId(graph.id, toNodeId(1), 'valuesWidget'))?.value
      ).toBe(77)
    })

    it('registers the live widget type', () => {
      const widget = createMutableTypeWidget(node)
      widget.type = 'number-custom'

      widget.setNodeId(toNodeId(1))

      expect(
        store.getWidget(widgetId(graph.id, toNodeId(1), 'typeChangedWidget'))
          ?.type
      ).toBe('number-custom')
    })

    it('registers replaced options after graph attachment', () => {
      const detachedNode = new LGraphNode('DetachedNode')
      const widget = detachedNode.addWidget(
        'combo',
        'resolution',
        'initial',
        null,
        { values: ['initial'] }
      )
      widget.hidden = true
      widget.options = { values: ['replacement'] }

      graph.add(detachedNode)

      expect(
        store.getWidget(widgetId(graph.id, detachedNode.id, 'resolution'))
          ?.options
      ).toEqual({ values: ['replacement'], hidden: true })
    })

    it('registers duplicate widget names under distinct ids', () => {
      const first = createTestWidget(node, { name: 'duplicate' })
      const second = createTestWidget(node, { name: 'duplicate' })
      node.widgets = [first, second]

      first.setNodeId(toNodeId(1))
      second.setNodeId(toNodeId(1))

      expect(first.widgetId).toBe(widgetId(graph.id, toNodeId(1), 'duplicate'))
      expect(second.widgetId).toBe(
        widgetId(graph.id, toNodeId(1), 'duplicate#1')
      )
      expect(node.widgets.map(({ name }) => name)).toEqual([
        'duplicate',
        'duplicate#1'
      ])
      expect(store.getNodeWidgetIds(graph.id, toNodeId(1))).toEqual([
        first.widgetId,
        second.widgetId
      ])
    })

    it('keeps ids stable and avoids literal suffix collisions', () => {
      const first = createTestWidget(node, { name: 'duplicate' })
      const second = createTestWidget(node, { name: 'duplicate' })
      const literal = createTestWidget(node, { name: 'duplicate#1' })
      node.widgets = [first, second, literal]

      for (const widget of [first, second, literal]) {
        widget.setNodeId(toNodeId(1))
      }
      const ids = node.widgets.map((widget) => widget.widgetId)
      node.widgets.reverse()

      expect(ids).toEqual([
        widgetId(graph.id, toNodeId(1), 'duplicate'),
        widgetId(graph.id, toNodeId(1), 'duplicate#2'),
        widgetId(graph.id, toNodeId(1), 'duplicate#1')
      ])
      expect(node.widgets.map((widget) => widget.widgetId).reverse()).toEqual(
        ids
      )
      expect(
        ids.map((id) => (id ? store.getWidget(id)?.name : undefined))
      ).toEqual(['duplicate', 'duplicate#2', 'duplicate#1'])
      expect(node.widgets.map(({ name }) => name).reverse()).toEqual([
        'duplicate',
        'duplicate#2',
        'duplicate#1'
      ])
    })

    it('stores explicit isDOMWidget false over component presence', () => {
      const widget = createTestWidget(node, { name: 'flaggedDomWidget' })
      Object.assign(widget, { component: {}, isDOMWidget: false })

      widget.setNodeId(toNodeId(1))

      expect(
        store.getWidgetRenderState(
          widgetId(graph.id, toNodeId(1), 'flaggedDomWidget')
        )?.isDOMWidget
      ).toBe(false)
    })
  })

  describe('DOM widget value registration', () => {
    it('registers value from getter when value property is overridden', () => {
      const defaultValue = 'You are an expert image-generation engine.'
      const widget = createTestWidget(node, {
        name: 'system_prompt',
        value: fromAny<number, unknown>(undefined)
      })

      // Simulate what addDOMWidget does: override value with getter/setter
      // that falls back to a default (like inputEl.value for textarea widgets)
      Object.defineProperty(widget, 'value', {
        get() {
          const graphId = widget.node.graph?.rootGraph.id
          if (!graphId) return defaultValue
          const state = store.getWidget(
            widgetId(graphId, node.id, 'system_prompt')
          )
          return (state?.value as string) ?? defaultValue
        },
        set(v: string) {
          const graphId = widget.node.graph?.rootGraph.id
          if (!graphId) return
          const state = store.getWidget(
            widgetId(graphId, node.id, 'system_prompt')
          )
          if (state) state.value = v
        }
      })

      widget.setNodeId(node.id)

      const state = store.getWidget(
        widgetId(graph.id, node.id, 'system_prompt')
      )
      expect(state?.value).toBe(defaultValue)
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
      widget.setNodeId(toNodeId(1))

      widget.disabled = undefined

      const state = store.getWidget(
        widgetId(graph.id, toNodeId(1), 'testWidget')
      )
      expect(state?.disabled).toBe(false)
    })
  })

  describe('un-keyable widget id (empty name)', () => {
    it('keeps local state usable when registration is declined', () => {
      const widget = createTestWidget(node, { name: '', value: 55 })

      expect(() => widget.setNodeId(toNodeId(1))).not.toThrow()
      expect(
        store.getWidget(widgetId(graph.id, toNodeId(1), ''))
      ).toBeUndefined()

      expect(widget.value).toBe(55)
      widget.value = 88
      expect(widget.value).toBe(88)
    })
  })
})
