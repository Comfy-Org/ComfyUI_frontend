import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { usePromotionStore } from '@/stores/promotionStore'
import TabSubgraphInputs from './TabSubgraphInputs.vue'

const {
  mockDraggable,
  mockDropTargetForElements,
  capturedDropHandlers,
  mockDraggableCleanup,
  mockDropTargetCleanup
} = vi.hoisted(() => {
  const capturedDropHandlers: Array<
    (args: { source: { data: Record<string, unknown> } }) => void
  > = []
  const mockDraggableCleanup = vi.fn()
  const mockDropTargetCleanup = vi.fn()
  const mockDraggable = vi.fn(() => mockDraggableCleanup)
  const mockDropTargetForElements = vi.fn(
    (config: {
      element: HTMLElement
      onDrop: (args: { source: { data: Record<string, unknown> } }) => void
    }) => {
      capturedDropHandlers.push(config.onDrop)
      return mockDropTargetCleanup
    }
  )
  return {
    mockDraggable,
    mockDropTargetForElements,
    capturedDropHandlers,
    mockDraggableCleanup,
    mockDropTargetCleanup
  }
})

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: mockDraggable,
  dropTargetForElements: mockDropTargetForElements
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue',
  () => ({ default: { template: '<div />' } })
)

vi.mock('@/components/rightSidePanel/layout/CollapseToggleButton.vue', () => ({
  default: { template: '<div />' }
}))

vi.mock('./SectionWidgets.vue', async () => {
  const { defineComponent: dc, ref: r } = await import('vue')
  return {
    default: dc({
      name: 'SectionWidgets',
      props: [
        'widgets',
        'collapse',
        'label',
        'node',
        'parents',
        'isDraggable',
        'enableEmptyState',
        'tooltip',
        'showNodeName'
      ],
      emits: ['update:collapse'],
      setup(
        _: unknown,
        { expose }: { expose: (exposed: Record<string, unknown>) => void }
      ) {
        const container = r<HTMLElement | undefined>(undefined)
        expose({
          widgetsContainer: container,
          rootElement: r<HTMLElement | undefined>(undefined)
        })
        return { container }
      },
      template: `<div><div ref="container"><div class="draggable-item" /><div class="draggable-item" /></div></div>`
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        inputs: 'Inputs',
        inputsNone: 'No Inputs',
        inputsNoneTooltip: 'No inputs tooltip',
        advancedInputs: 'Advanced Inputs',
        noneSearchDesc: 'No results found'
      }
    }
  }
})

function createMockNode(): SubgraphNode {
  return fromAny<SubgraphNode, unknown>({
    id: '1',
    rootGraph: { id: 'graph-1' },
    widgets: [],
    subgraph: { nodes: [] }
  })
}

function renderComponent(node: SubgraphNode = createMockNode()) {
  return render(TabSubgraphInputs, {
    props: { node },
    global: { plugins: [i18n] }
  })
}

describe('TabSubgraphInputs drag-and-drop', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    capturedDropHandlers.length = 0
    vi.clearAllMocks()
  })

  it('attaches draggable and drop-target handlers to each item on mount', () => {
    renderComponent()

    expect(mockDraggable).toHaveBeenCalledTimes(2)
    expect(mockDropTargetForElements).toHaveBeenCalledTimes(2)
  })

  it('runs cleanup for all registered handlers on unmount', () => {
    const { unmount } = renderComponent()

    unmount()

    expect(mockDraggableCleanup).toHaveBeenCalledTimes(2)
    expect(mockDropTargetCleanup).toHaveBeenCalledTimes(2)
  })

  it('calls movePromotion with correct indices when an item is dropped', () => {
    const node = createMockNode()
    renderComponent(node)

    const promotionStore = usePromotionStore()
    vi.spyOn(promotionStore, 'movePromotion')

    capturedDropHandlers[1]({ source: { data: { index: 0 } } })

    expect(promotionStore.movePromotion).toHaveBeenCalledWith(
      'graph-1',
      '1',
      0,
      1
    )
  })

  it('does not call movePromotion when item is dropped onto itself', () => {
    const node = createMockNode()
    renderComponent(node)

    const promotionStore = usePromotionStore()
    vi.spyOn(promotionStore, 'movePromotion')

    capturedDropHandlers[0]({ source: { data: { index: 0 } } })

    expect(promotionStore.movePromotion).not.toHaveBeenCalled()
  })
})
