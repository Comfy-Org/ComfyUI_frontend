import { fromAny } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface FakeDOMWidget {
  name: string
  type: string
  element: HTMLElement
  options: Record<string, unknown>
  value: string
  callback?: (value: string) => void
  onRemove?: () => void
  serialize?: boolean
  serializeValue?: () => unknown
}

interface FakeMediaWidget {
  name: string
  element: HTMLElement
  onRemove?: () => void
  serialize?: boolean
  serializeValue?: () => unknown
  computeLayoutSize?: () => { minHeight: number; minWidth: number }
}

export function createMockDOMWidgetNode(
  overrides: Record<string, unknown> = {}
) {
  const widgets: FakeDOMWidget[] = []
  return fromAny<LGraphNode & { widgets: FakeDOMWidget[] }, unknown>({
    id: 1,
    widgets,
    addDOMWidget: vi.fn((name: string, type: string, element: HTMLElement) => {
      const widget: FakeDOMWidget = {
        name,
        type,
        element,
        options: {},
        value: ''
      }
      widgets.push(widget)
      return widget
    }),
    ...overrides
  })
}

export function createMockMediaNode(overrides: Record<string, unknown> = {}) {
  const widgets: FakeMediaWidget[] = []
  return fromAny<LGraphNode & { widgets: FakeMediaWidget[] }, unknown>({
    widgets,
    addDOMWidget: vi.fn((name: string, _type: string, element: HTMLElement) => {
      const widget: FakeMediaWidget = { name, element }
      widgets.push(widget)
      return widget
    }),
    ...overrides
  })
}
