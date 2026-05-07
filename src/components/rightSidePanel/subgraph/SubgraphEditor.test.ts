import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { SubgraphNode as RuntimeSubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import SubgraphEditor from './SubgraphEditor.vue'

const mockSelectedItems = ref<unknown[]>([])

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty: vi.fn() },
    get selectedItems() {
      return mockSelectedItems.value
    }
  })
}))

vi.mock('@/stores/promotionStore', () => ({
  usePromotionStore: () => ({
    getPromotions: vi.fn(() => []),
    setPromotions: vi.fn(),
    isPromoted: vi.fn(() => false),
    movePromotion: vi.fn()
  })
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    updatePreviews: vi.fn()
  })
}))

vi.mock('@/core/graph/subgraph/promotedWidgetTypes', () => ({
  isPromotedWidgetView: vi.fn(() => false)
}))

vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  demoteWidget: vi.fn(),
  getPromotableWidgets: vi.fn((node: { widgets?: unknown[] }) =>
    Array.isArray(node?.widgets) ? node.widgets : []
  ),
  getSourceNodeId: vi.fn(() => undefined),
  getWidgetName: vi.fn((widget: { name: string }) => widget.name),
  isLinkedPromotion: vi.fn(() => false),
  isRecommendedWidget: vi.fn(() => false),
  promoteWidget: vi.fn(),
  pruneDisconnected: vi.fn()
}))

vi.mock('@/lib/litegraph/src/subgraph/SubgraphNode', () => {
  class SubgraphNode {}
  return { SubgraphNode }
})

const FormSearchInputStub = defineComponent({
  props: {
    modelValue: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(_, { emit }) {
    function onInput(event: Event) {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }
    return { onInput }
  },
  template:
    '<input data-testid="search-input" :value="modelValue" @input="onInput" />'
})

const SubgraphNodeWidgetStub = defineComponent({
  props: {
    nodeTitle: { type: String, default: '' },
    widgetName: { type: String, default: '' }
  },
  template:
    '<div data-testid="subgraph-widget">{{ nodeTitle }}::{{ widgetName }}</div>'
})

const DraggableListStub = defineComponent({
  template: '<div><slot :dragClass="\'\'" /></div>'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        noneSearchDesc: 'No results found'
      },
      subgraphStore: {
        linked: 'Linked',
        shown: 'Shown',
        hidden: 'Hidden',
        showAll: 'Show all',
        hideAll: 'Hide all',
        showRecommended: 'Show recommended'
      }
    }
  }
})

function makeSubgraphNode(): SubgraphNode {
  const interiorAlpha = fromAny({
    id: 11,
    title: 'Alpha Interior',
    widgets: [
      {
        name: 'alpha-widget',
        type: 'text',
        value: 'alpha',
        computedDisabled: false,
        options: {}
      }
    ],
    updateComputedDisabled: () => undefined
  })
  const interiorBeta = fromAny({
    id: 22,
    title: 'Beta Interior',
    widgets: [
      {
        name: 'beta-widget',
        type: 'text',
        value: 'beta',
        computedDisabled: false,
        options: {}
      }
    ],
    updateComputedDisabled: () => undefined
  })

  const NodeCtor = RuntimeSubgraphNode as unknown as new () => SubgraphNode
  return fromAny<SubgraphNode, unknown>(
    Object.assign(new NodeCtor(), {
      id: 100,
      rootGraph: { id: 'root-1' },
      widgets: [],
      subgraph: {
        _nodes_by_id: { '11': interiorAlpha, '22': interiorBeta },
        nodes: [interiorAlpha, interiorBeta]
      },
      computeSize: vi.fn(),
      setDirtyCanvas: vi.fn()
    })
  )
}

const renderOptions = {
  global: {
    plugins: [i18n],
    stubs: {
      FormSearchInput: FormSearchInputStub,
      SubgraphNodeWidget: SubgraphNodeWidgetStub,
      DraggableList: DraggableListStub,
      Button: { template: '<button v-bind="$attrs"><slot /></button>' }
    }
  }
}

describe('SubgraphEditor', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockSelectedItems.value = [makeSubgraphNode()]
  })

  it('starts with an empty search query and renders candidate widgets', () => {
    render(SubgraphEditor, renderOptions)

    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.getByText('Alpha Interior::alpha-widget')).toBeInTheDocument()
    expect(screen.getByText('Beta Interior::beta-widget')).toBeInTheDocument()
  })

  it('filters candidate widgets when the user types into the search', async () => {
    const user = userEvent.setup()
    render(SubgraphEditor, renderOptions)

    await user.type(screen.getByTestId('search-input'), 'alpha')

    expect(screen.getByTestId('search-input')).toHaveValue('alpha')
    expect(screen.getByText('Alpha Interior::alpha-widget')).toBeInTheDocument()
    expect(
      screen.queryByText('Beta Interior::beta-widget')
    ).not.toBeInTheDocument()
  })

  it('resets local search query after a key-based remount', async () => {
    const user = userEvent.setup()

    const Wrapper = defineComponent({
      components: { SubgraphEditor },
      props: {
        k: { type: String, required: true }
      },
      template: '<SubgraphEditor :key="k" />'
    })

    const { rerender } = render(Wrapper, {
      props: { k: 'ctx-1' },
      ...renderOptions
    })

    await user.type(screen.getByTestId('search-input'), 'alpha')
    expect(screen.getByTestId('search-input')).toHaveValue('alpha')
    expect(
      screen.queryByText('Beta Interior::beta-widget')
    ).not.toBeInTheDocument()

    await rerender({ k: 'ctx-2' })

    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.getByText('Alpha Interior::alpha-widget')).toBeInTheDocument()
    expect(screen.getByText('Beta Interior::beta-widget')).toBeInTheDocument()
  })
})
