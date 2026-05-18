import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import type { Slots } from 'vue'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { usePromotionStore } from '@/stores/promotionStore'
import WidgetActions from './WidgetActions.vue'

const { mockGetInputSpecForWidget } = vi.hoisted(() => ({
  mockGetInputSpecForWidget: vi.fn()
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    getInputSpecForWidget: mockGetInputSpecForWidget
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty: vi.fn() }
  })
}))

vi.mock('@/stores/workspace/favoritedWidgetsStore', () => ({
  useFavoritedWidgetsStore: () => ({
    isFavorited: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn()
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    prompt: vi.fn()
  })
}))

vi.mock('@/components/button/MoreButton.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.({ close: () => {} }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        rename: 'Rename',
        enterNewName: 'Enter new name'
      },
      rightSidePanel: {
        hideInput: 'Hide input',
        showInput: 'Show input',
        addFavorite: 'Favorite',
        removeFavorite: 'Unfavorite',
        resetToDefault: 'Reset to default'
      }
    }
  }
})

describe('WidgetActions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'INT',
      default: 42
    })
  })

  function createMockWidget(
    value: number = 100,
    callback?: () => void
  ): IBaseWidget {
    return {
      name: 'test_widget',
      type: 'number',
      value,
      label: 'Test Widget',
      options: {},
      y: 0,
      callback
    } as IBaseWidget
  }

  function createMockNode(): LGraphNode {
    return fromAny<LGraphNode, unknown>({
      id: 1,
      type: 'TestNode',
      rootGraph: { id: 'graph-test' },
      computeSize: vi.fn(),
      size: [200, 100],
      isSubgraphNode: () => false
    })
  }

  function renderWidgetActions(
    widget: IBaseWidget,
    node: LGraphNode,
    extraProps: Record<string, unknown> = {}
  ) {
    const user = userEvent.setup()
    const onResetToDefault = vi.fn()
    render(WidgetActions, {
      props: {
        widget,
        node,
        label: 'Test Widget',
        onResetToDefault,
        ...extraProps
      },
      global: {
        plugins: [i18n]
      }
    })
    return { user, onResetToDefault }
  }

  it('shows reset button when widget has default value', () => {
    const widget = createMockWidget()
    const node = createMockNode()

    renderWidgetActions(widget, node)

    expect(screen.getByRole('button', { name: /Reset/ })).toBeInTheDocument()
  })

  it('emits resetToDefault with default value when reset button clicked', async () => {
    const widget = createMockWidget(100)
    const node = createMockNode()

    const { user, onResetToDefault } = renderWidgetActions(widget, node)

    await user.click(screen.getByRole('button', { name: /Reset/ }))

    expect(onResetToDefault).toHaveBeenCalledTimes(1)
    expect(onResetToDefault).toHaveBeenCalledWith(42)
  })

  it('disables reset button when value equals default', () => {
    const widget = createMockWidget(42)
    const node = createMockNode()

    renderWidgetActions(widget, node)

    expect(screen.getByRole('button', { name: /Reset/ })).toBeDisabled()
  })

  it('does not show reset button when no default value exists', () => {
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'CUSTOM'
    })

    const widget = createMockWidget(100)
    const node = createMockNode()

    renderWidgetActions(widget, node)

    expect(
      screen.queryByRole('button', { name: /Reset/ })
    ).not.toBeInTheDocument()
  })

  it('uses fallback default for INT type without explicit default', async () => {
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'INT'
    })

    const widget = createMockWidget(100)
    const node = createMockNode()

    const { user, onResetToDefault } = renderWidgetActions(widget, node)

    await user.click(screen.getByRole('button', { name: /Reset/ }))

    expect(onResetToDefault).toHaveBeenCalledWith(0)
  })

  it('uses first option as default for combo without explicit default', async () => {
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'COMBO',
      options: ['option1', 'option2', 'option3']
    })

    const widget = createMockWidget(100)
    const node = createMockNode()

    const { user, onResetToDefault } = renderWidgetActions(widget, node)

    await user.click(screen.getByRole('button', { name: /Reset/ }))

    expect(onResetToDefault).toHaveBeenCalledWith('option1')
  })

  it('demotes promoted widgets by immediate interior node identity when shown from parent context', async () => {
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'CUSTOM'
    })
    const parentSubgraphNode = fromAny<SubgraphNode, unknown>({
      id: 4,
      rootGraph: { id: 'graph-test' },
      computeSize: vi.fn(),
      size: [300, 150]
    })
    const node = fromAny<LGraphNode, unknown>({
      id: 4,
      type: 'SubgraphNode',
      rootGraph: { id: 'graph-test' },
      isSubgraphNode: () => false
    })
    const widget = {
      name: 'text',
      type: 'text',
      value: 'value',
      label: 'Text',
      options: {},
      y: 0,
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    } as IBaseWidget

    const promotionStore = usePromotionStore()
    promotionStore.promote('graph-test', 4, {
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    })

    const user = userEvent.setup()
    render(WidgetActions, {
      props: {
        widget,
        node,
        label: 'Text',
        parents: [parentSubgraphNode],
        isShownOnParents: true
      },
      global: {
        plugins: [i18n]
      }
    })

    await user.click(screen.getByRole('button', { name: /Hide input/ }))

    expect(
      promotionStore.isPromoted('graph-test', 4, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
    ).toBe(false)
  })
})
