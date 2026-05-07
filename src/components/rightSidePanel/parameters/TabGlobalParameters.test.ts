import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import TabGlobalParameters from './TabGlobalParameters.vue'

const mockValidFavoritedWidgets = ref([
  {
    node: { id: 1, title: 'Node A' },
    widget: {
      name: 'alpha-widget',
      type: 'text',
      value: 'alpha',
      options: {}
    }
  },
  {
    node: { id: 2, title: 'Node B' },
    widget: {
      name: 'beta-widget',
      type: 'text',
      value: 'beta',
      options: {}
    }
  }
])

const mockReorderFavorites = vi.fn()

vi.mock('@/stores/workspace/favoritedWidgetsStore', () => ({
  useFavoritedWidgetsStore: () => ({
    validFavoritedWidgets: mockValidFavoritedWidgets.value,
    reorderFavorites: mockReorderFavorites
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
      <ul>
        <li
          v-for="item in widgets"
          :key="item.widget.name"
          data-testid="widget-name"
        >
          {{ item.widget.name }}
        </li>
      </ul>
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
        favorites: 'Favorites',
        favoritesNone: 'No favorites',
        noneSearchDesc: 'No results found',
        favoritesNoneDesc: 'Add favorites to get started',
        favoritesNoneHint: 'Use the <moreIcon/> menu to favorite widgets'
      }
    }
  }
})

function renderComponent() {
  const user = userEvent.setup()

  const result = render(TabGlobalParameters, {
    global: {
      plugins: [i18n],
      stubs: {
        FormSearchInput: FormSearchInputStub,
        SectionWidgets: SectionWidgetsStub
      }
    }
  })

  return { user, ...result }
}

describe('TabGlobalParameters', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('starts with empty search query and filters widgets as user types', async () => {
    const { user } = renderComponent()

    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.getByText('alpha-widget')).toBeInTheDocument()
    expect(screen.getByText('beta-widget')).toBeInTheDocument()

    await user.type(screen.getByTestId('search-input'), 'alpha-widget')

    expect(screen.getByTestId('search-input')).toHaveValue('alpha-widget')
    expect(screen.getByText('alpha-widget')).toBeInTheDocument()
    expect(screen.queryByText('beta-widget')).not.toBeInTheDocument()
  })

  it('resets local search query after remount via key change', async () => {
    const user = userEvent.setup()
    const Wrapper = defineComponent({
      components: { TabGlobalParameters },
      props: {
        k: { type: String, required: true }
      },
      template: '<TabGlobalParameters :key="k" />'
    })

    const { rerender } = render(Wrapper, {
      props: { k: 'ctx-1' },
      global: {
        plugins: [i18n],
        stubs: {
          FormSearchInput: FormSearchInputStub,
          SectionWidgets: SectionWidgetsStub
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
