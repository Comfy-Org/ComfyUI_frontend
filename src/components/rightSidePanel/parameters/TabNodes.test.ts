import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import TabNodes from './TabNodes.vue'

const mockNodes = [
  fromAny<LGraphNode, unknown>({
    id: 11,
    title: 'Alpha Node',
    getTitle: () => 'Alpha Node',
    widgets: [
      {
        name: 'alpha-widget',
        type: 'text',
        value: 'alpha',
        options: {}
      }
    ]
  }),
  fromAny<LGraphNode, unknown>({
    id: 22,
    title: 'Beta Node',
    getTitle: () => 'Beta Node',
    widgets: [
      {
        name: 'beta-widget',
        type: 'text',
        value: 'beta',
        options: {}
      }
    ]
  })
]

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => false)
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        nodes: mockNodes
      }
    }
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { path: 'workflow-a' }
  })
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
    node: { type: Object, required: true },
    widgets: { type: Array, default: () => [] }
  },
  template: `
    <div data-testid="section-item">
      <span data-testid="node-title">{{ node.title }}</span>
      <span
        v-for="item in widgets"
        :key="item.widget.name"
        data-testid="widget-name"
      >
        {{ item.widget.name }}
      </span>
    </div>
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        noneSearchDesc: 'No results found',
        inputsNoneTooltip: 'No inputs'
      }
    }
  }
})

describe('TabNodes', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('starts with an empty search and filters node widgets', async () => {
    const user = userEvent.setup()

    render(TabNodes, {
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

  it('creates fresh local search state after key-driven remount', async () => {
    const user = userEvent.setup()
    const Wrapper = defineComponent({
      components: { TabNodes },
      props: {
        k: { type: String, required: true }
      },
      template: '<TabNodes :key="k" />'
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
