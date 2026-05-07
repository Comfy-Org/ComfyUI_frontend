import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import TabNormalInputs from './TabNormalInputs.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => false)
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
    node: { type: Object, default: undefined },
    widgets: { type: Array, default: () => [] }
  },
  template: `
    <div data-testid="section-item">
      <span v-if="node" data-testid="node-title">{{ node.title }}</span>
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
        nodesNoneDesc: 'No nodes selected',
        inputs: 'Inputs',
        inputsNone: 'No inputs',
        advancedInputs: 'Advanced Inputs',
        inputsNoneTooltip: 'No inputs available'
      }
    }
  }
})

function createNode(
  id: number,
  title: string,
  widgetName: string,
  options: { advanced?: boolean } = {}
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    title,
    getTitle: () => title,
    widgets: [
      {
        name: widgetName,
        type: 'text',
        value: widgetName,
        options
      }
    ]
  })
}

const testNodes = [
  createNode(1, 'Alpha Node', 'alpha-widget'),
  createNode(2, 'Beta Node', 'beta-widget')
]

describe('TabNormalInputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('starts with empty search query and filters widgets from provided nodes', async () => {
    const user = userEvent.setup()

    render(TabNormalInputs, {
      props: {
        nodes: testNodes
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

  it('resets local search query after remount with a new key', async () => {
    const user = userEvent.setup()

    const Wrapper = defineComponent({
      components: { TabNormalInputs },
      props: {
        k: { type: String, required: true }
      },
      setup() {
        return {
          nodes: testNodes
        }
      },
      template: '<TabNormalInputs :key="k" :nodes="nodes" />'
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
