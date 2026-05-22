import { fromAny } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface FakeMediaWidget {
  name: string
  element: HTMLElement
  onRemove?: () => void
  serialize?: boolean
  serializeValue?: () => unknown
  computeLayoutSize?: () => { minHeight: number; minWidth: number }
}

type NodeOverrides = Record<string, unknown> & { widgets?: never }

export function createMockMediaNode(overrides: NodeOverrides = {}) {
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
