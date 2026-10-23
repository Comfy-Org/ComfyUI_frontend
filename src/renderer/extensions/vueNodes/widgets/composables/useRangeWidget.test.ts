import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

import { useRangeWidget } from './useRangeWidget'

describe(useRangeWidget, () => {
  it.for([
    { surface: 'vueNode', visible: true },
    { surface: 'panel', visible: false }
  ] as const)(
    'creates a range widget visible on $surface: $visible',
    ({ surface, visible }) => {
      const widget = useRangeWidget()(new LGraphNode('Levels'), {
        type: 'RANGE',
        name: 'levels'
      })

      expect(
        isWidgetVisibleOnSurface(deriveWidgetVisibility(widget), surface, {
          showAdvanced: true
        })
      ).toBe(visible)
    }
  )
})
