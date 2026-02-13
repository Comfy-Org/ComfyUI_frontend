import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { renameWidget } from './widgetUtil'

function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    name: 'seed',
    type: 'number',
    value: 42,
    options: {},
    y: 0,
    ...overrides
  } satisfies Partial<IBaseWidget> as IBaseWidget
}

function createMockNode(
  widgets: IBaseWidget[] = [],
  inputs: INodeInputSlot[] = []
): LGraphNode {
  return {
    widgets,
    inputs
  } satisfies Partial<Omit<LGraphNode, 'constructor'>> as unknown as LGraphNode
}

describe('renameWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets widget label to new name', () => {
    const widget = createMockWidget()
    const node = createMockNode([widget])

    renameWidget(widget, node, 'New Name')
    expect(widget.label).toBe('New Name')
  })

  it('clears widget label when given empty string', () => {
    const widget = createMockWidget()
    widget.label = 'Old'
    const node = createMockNode([widget])

    renameWidget(widget, node, '')
    expect(widget.label).toBeUndefined()
  })

  it('updates matching input label', () => {
    const widget = createMockWidget()
    const input = {
      name: 'seed',
      link: null,
      widget: { name: 'seed' },
      label: undefined as string | undefined
    } satisfies Partial<INodeInputSlot> as INodeInputSlot
    const node = createMockNode([widget], [input])

    renameWidget(widget, node, 'Renamed')
    expect(input.label).toBe('Renamed')
  })

  it('returns true on success', () => {
    const widget = createMockWidget()
    const node = createMockNode([widget])

    expect(renameWidget(widget, node, 'New')).toBe(true)
  })
})
