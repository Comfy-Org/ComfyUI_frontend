import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'
import { testI18n } from '@/utils/__tests__/testI18n'

import WidgetDOM from './WidgetDOM.vue'
import WidgetLegacy from './WidgetLegacy.vue'

vi.mock(import('@/scripts/app'))

function externalOwners() {
  const interior = createTestSubgraph()
  const root = interior.rootGraph
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(root)
  const a = new LGraphNode('External A')
  const b = new LGraphNode('External B')
  root.add(a)
  root.add(b)
  stubCanvasGetContext()
  onTestFinished(() =>
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
  )
  const canvas = new LGraphCanvas(document.createElement('canvas'), interior, {
    skip_render: true,
    skip_events: true
  })
  useCanvasStore().canvas = canvas
  useCanvasStore().currentGraph = interior
  return { a, b, root }
}

function domWidget(node: LGraphNode, value: string) {
  const element = document.createElement('input')
  element.setAttribute('aria-label', 'Custom value')
  element.value = value
  const widget = node.addCustomWidget<
    IBaseWidget & { element: HTMLInputElement }
  >({
    name: 'value',
    type: 'owner-test-dom',
    value,
    y: 0,
    options: {},
    element
  })
  element.addEventListener('input', () => {
    widget.value = element.value
  })
  return widget
}

describe('off-graph widget ownership', () => {
  it.for(['disabled', 'read_only'] as const)(
    'applies native inert semantics to a raw DOM widget marked %s',
    async (option) => {
      const { a } = externalOwners()
      const widget = domWidget(a, 'original')
      widget.options[option] = true
      const Probe = defineComponent({
        setup() {
          const { processedWidgets } = useProcessedWidgets(() => a._state)
          return () =>
            h(
              TooltipProvider,
              {},
              {
                default: () =>
                  h(WidgetGrid, {
                    nodeId: a.id,
                    nodeType: a.type,
                    presentation: 'form',
                    processedWidgets: processedWidgets.value
                  })
              }
            )
        }
      })

      render(Probe, { global: { plugins: [testI18n] } })

      expect(screen.getByRole('textbox', { name: 'Custom value' })).toHaveValue(
        'original'
      )
      expect(screen.getByTestId('widget-control-shell')).toHaveAttribute(
        'inert'
      )
      expect(widget.value).toBe('original')
    }
  )
  it('edits the explicitly located DOM owner and rebinds when that owner changes', async () => {
    const { a, b } = externalOwners()
    const first = domWidget(a, 'first')
    const second = domWidget(b, 'second')
    assert.exists(first.widgetId)
    assert.exists(second.widgetId)
    const { rerender } = render(WidgetDOM, {
      props: {
        nodeId: a.id,
        widget: {
          name: 'value',
          type: 'owner-test-dom',
          value: undefined,
          hostNodeLocatorId: createNodeLocatorId(null, a.id)
        }
      }
    })
    const user = userEvent.setup()
    await user.clear(screen.getByRole('textbox', { name: 'Custom value' }))
    await user.type(screen.getByRole('textbox', { name: 'Custom value' }), 'A')
    await rerender({
      widget: {
        name: 'value',
        type: 'owner-test-dom',
        value: undefined,
        hostNodeLocatorId: createNodeLocatorId(null, b.id)
      }
    })
    expect(screen.getByRole('textbox', { name: 'Custom value' })).toHaveValue(
      'second'
    )
    await user.clear(screen.getByRole('textbox', { name: 'Custom value' }))
    await user.type(screen.getByRole('textbox', { name: 'Custom value' }), 'B')

    const store = useWidgetValueStore()
    expect([
      store.getWidget(first.widgetId)?.value,
      store.getWidget(second.widgetId)?.value
    ]).toEqual(['A', 'B'])
  })

  it('sends legacy pointer edits to the explicit owner after rebinding', async () => {
    const { a, b } = externalOwners()
    const first = a.addCustomWidget<IBaseWidget>({
      name: 'value',
      type: 'owner-test-legacy',
      value: 1,
      y: 0,
      options: {},
      draw() {},
      mouse() {
        first.value = 17
        return true
      }
    })
    const second = b.addCustomWidget<IBaseWidget>({
      name: 'value',
      type: 'owner-test-legacy',
      value: 2,
      y: 0,
      options: {},
      draw() {},
      mouse() {
        second.value = 29
        return true
      }
    })
    assert.exists(first.widgetId)
    assert.exists(second.widgetId)
    const { rerender } = render(WidgetLegacy, {
      props: {
        nodeId: a.id,
        widget: {
          name: 'value',
          type: 'owner-test-legacy',
          value: undefined,
          hostNodeLocatorId: createNodeLocatorId(null, a.id)
        }
      }
    })
    await rerender({
      widget: {
        name: 'value',
        type: 'owner-test-legacy',
        value: undefined,
        hostNodeLocatorId: createNodeLocatorId(null, b.id)
      }
    })

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: screen.getByTestId('legacy-widget-canvas'),
      coords: { offsetX: 28, offsetY: 11 }
    })

    const store = useWidgetValueStore()
    expect([
      store.getWidget(first.widgetId)?.value,
      store.getWidget(second.widgetId)?.value
    ]).toEqual([1, 29])
  })
})
