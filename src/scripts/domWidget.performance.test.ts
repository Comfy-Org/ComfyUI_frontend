import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'

describe('DOM widget layout-read matrix', () => {
  const widgetCounts = [0, 10, 100] as const

  it.for(widgetCounts)(
    'performs one computed-style read for each of %i visible legacy DOM widgets',
    (count) => {
      const getStyle = vi.spyOn(window, 'getComputedStyle')
      const node = new LGraphNode('host')
      const widgets = Array.from(
        { length: count },
        (_, index) =>
          new DOMWidgetImpl({
            node,
            name: `legacy-${index}`,
            type: 'customtext',
            element: document.createElement('textarea'),
            options: { getHeight: () => 50 }
          })
      )

      for (const widget of widgets) widget.computeLayoutSize(node)

      expect(getStyle).toHaveBeenCalledTimes(count)
    }
  )

  it.for(widgetCounts)(
    'performs no computed-style reads for %i hidden legacy DOM widgets',
    (count) => {
      const getStyle = vi.spyOn(window, 'getComputedStyle')
      const node = new LGraphNode('host')
      const widgets = Array.from(
        { length: count },
        (_, index) =>
          new DOMWidgetImpl({
            node,
            name: `hidden-${index}`,
            type: 'hidden',
            element: document.createElement('textarea'),
            options: {}
          })
      )

      for (const widget of widgets) widget.computeLayoutSize(node)

      expect(getStyle).not.toHaveBeenCalled()
    }
  )

  it.for(widgetCounts)(
    'performs no computed-style reads for %i Vue component widgets',
    (count) => {
      const getStyle = vi.spyOn(window, 'getComputedStyle')
      const node = new LGraphNode('host')
      const component = defineComponent({ template: '<div />' })
      const widgets = Array.from(
        { length: count },
        (_, index) =>
          new ComponentWidgetImpl({
            node,
            name: `component-${index}`,
            component,
            inputSpec: { name: `component-${index}`, type: 'string' },
            options: {}
          })
      )

      for (const widget of widgets) widget.computeLayoutSize()

      expect(getStyle).not.toHaveBeenCalled()
    }
  )
})
