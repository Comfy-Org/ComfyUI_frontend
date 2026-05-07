import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import TabSubgraphInputs from './TabSubgraphInputs.vue'

vi.mock(import('pinia'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    storeToRefs: vi.fn((store) => store)
  }
})

const mockClearFocusedSection = vi.fn()

vi.mock('@/core/graph/subgraph/promotedWidgetTypes', () => ({
  isPromotedWidgetView: vi.fn(() => false)
}))

vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  getWidgetName: vi.fn((widget) => widget.name)
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      setDirty: vi.fn()
    }
  })
}))

vi.mock('@/stores/promotionStore', () => ({
  usePromotionStore: () => ({
    getPromotions: vi.fn(() => [
      {
        sourceNodeId: '11',
        sourceWidgetName: 'alpha-widget',
        disambiguatingSourceNodeId: undefined
      },
      {
        sourceNodeId: '22',
        sourceWidgetName: 'beta-widget',
        disambiguatingSourceNodeId: undefined
      }
    ]),
    isPromoted: vi.fn(() => false),
    movePromotion: vi.fn()
  })
}))

vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({
    focusedSection: null,
    clearFocusedSection: mockClearFocusedSection
  })
}))

vi.mock('@/scripts/ui/draggableList', () => ({
  DraggableList: vi.fn().mockImplementation(() => ({ dispose: vi.fn() }))
}))

const FormSearchInputStub = defineComponent({
  props: {
    modelValue: { type: String, default: '' },
    searcher: { type: Function, default: undefined }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function onInput(event: Event) {
      const value = (event.target as HTMLInputElement).value
      emit('update:modelValue', value)
      props.searcher?.(value)
    }

    return { onInput }
  },
  template:
    '<input data-testid="search-input" :value="modelValue" @input="onInput" />'
})

const SectionWidgetsStub = defineComponent({
  props: {
    widgets: { type: Array, default: () => [] }
  },
  template: `
    <div>
      <span
        v-for="item in widgets"
        :key="item.widget.name"
        data-testid="widget-name"
      >
        {{ item.widget.name }}
      </span>
      <slot v-if="widgets.length === 0" name="empty" />
    </div>
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        inputs: 'Inputs',
        inputsNone: 'No inputs',
        advancedInputs: 'Advanced Inputs',
        noneSearchDesc: 'No results found',
        inputsNoneTooltip: 'No inputs available'
      }
    }
  }
})

const subgraphNode = fromAny<SubgraphNode, unknown>({
  id: 100,
  rootGraph: { id: 'root-1' },
  widgets: [
    {
      name: 'alpha-widget',
      type: 'text',
      value: 'alpha',
      options: {}
    },
    {
      name: 'beta-widget',
      type: 'text',
      value: 'beta',
      options: {}
    }
  ],
  subgraph: {
    nodes: [
      {
        id: 11,
        title: 'Interior 1',
        widgets: [
          {
            name: 'interior-widget',
            type: 'text',
            value: 'interior',
            computedDisabled: false,
            options: {}
          }
        ]
      }
    ]
  }
})

describe('TabSubgraphInputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('starts with an empty search and filters promoted widgets', async () => {
    const user = userEvent.setup()

    render(TabSubgraphInputs, {
      props: {
        node: subgraphNode
      },
      global: {
        plugins: [i18n],
        stubs: {
          FormSearchInput: FormSearchInputStub,
          SectionWidgets: SectionWidgetsStub,
          CollapseToggleButton: { template: '<div />' }
        }
      }
    })

    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.getByText('alpha-widget')).toBeInTheDocument()
    expect(screen.getByText('beta-widget')).toBeInTheDocument()

    await user.type(screen.getByTestId('search-input'), 'alpha-widget')

    expect(screen.getByTestId('search-input')).toHaveValue('alpha-widget')
    expect(screen.getByText('alpha-widget')).toBeInTheDocument()
    expect(screen.queryByText('beta-widget')).not.toBeInTheDocument()
  })

  it('resets local search query after key-based remount', async () => {
    const user = userEvent.setup()

    const Wrapper = defineComponent({
      components: { TabSubgraphInputs },
      props: {
        k: { type: String, required: true }
      },
      setup() {
        return {
          node: subgraphNode
        }
      },
      template: '<TabSubgraphInputs :key="k" :node="node" />'
    })

    const { rerender } = render(Wrapper, {
      props: { k: 'ctx-1' },
      global: {
        plugins: [i18n],
        stubs: {
          FormSearchInput: FormSearchInputStub,
          SectionWidgets: SectionWidgetsStub,
          CollapseToggleButton: { template: '<div />' }
        }
      }
    })

    await user.type(screen.getByTestId('search-input'), 'beta-widget')
    expect(screen.getByTestId('search-input')).toHaveValue('beta-widget')

    await rerender({ k: 'ctx-2' })

    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.getByText('alpha-widget')).toBeInTheDocument()
    expect(screen.getByText('beta-widget')).toBeInTheDocument()
  })
})
