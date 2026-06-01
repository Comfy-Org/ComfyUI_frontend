import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const filterButtonStub = defineComponent({
  name: 'MediaAssetFilterButton',
  setup(_, { slots }) {
    return () =>
      h(
        'div',
        { 'data-testid': 'filter-button' },
        slots.default ? slots.default({ close: () => {} }) : []
      )
  }
})

const settingsButtonStub = defineComponent({
  name: 'MediaAssetSettingsButton',
  setup(_, { slots }) {
    return () =>
      h(
        'div',
        { 'data-testid': 'settings-button' },
        slots.default ? slots.default() : []
      )
  }
})

const settingsMenuCapture = { showSortOptions: undefined as unknown }
const settingsMenuStub = defineComponent({
  name: 'MediaAssetSettingsMenu',
  props: {
    sortBy: { type: String, default: 'newest' },
    viewMode: { type: String, default: 'grid' },
    showSortOptions: { type: Boolean, default: false },
    showGenerationTimeSort: { type: Boolean, default: false }
  },
  setup(props) {
    settingsMenuCapture.showSortOptions = props.showSortOptions
    return () => h('div', { 'data-testid': 'settings-menu' })
  }
})

const sidebarTopAreaStub = defineComponent({
  name: 'SidebarTopArea',
  setup(_, { slots }) {
    return () =>
      h('div', { 'data-testid': 'sidebar-top-area' }, [
        slots.default?.(),
        slots.actions?.()
      ])
  }
})

const searchInputStub = defineComponent({
  name: 'SearchInput',
  setup() {
    return () => h('input', { 'data-testid': 'search-input' })
  }
})

function mountFilterBar() {
  return render(
    defineComponent({
      components: { MediaAssetFilterBar },
      setup() {
        const sortBy = ref<'newest' | 'oldest'>('newest')
        const viewMode = ref<'grid' | 'list'>('grid')
        return { sortBy, viewMode }
      },
      template:
        '<MediaAssetFilterBar :search-query="\'\'" :media-type-filters="[]" v-model:sort-by="sortBy" v-model:view-mode="viewMode" />'
    }),
    {
      global: {
        stubs: {
          MediaAssetFilterButton: filterButtonStub,
          MediaAssetFilterMenu: { template: '<div />' },
          MediaAssetSettingsButton: settingsButtonStub,
          MediaAssetSettingsMenu: settingsMenuStub,
          SidebarTopArea: sidebarTopAreaStub,
          SearchInput: searchInputStub
        },
        mocks: {
          $t: (key: string) => key
        },
        directives: {
          tooltip: { mounted() {} }
        }
      }
    }
  )
}

describe('MediaAssetFilterBar', () => {
  it('renders the filter button unconditionally (FE-732)', () => {
    mountFilterBar()

    expect(screen.getByTestId('filter-button')).toBeTruthy()
  })

  it('passes show-sort-options=true to the settings menu (FE-732)', () => {
    settingsMenuCapture.showSortOptions = undefined
    mountFilterBar()

    expect(settingsMenuCapture.showSortOptions).toBe(true)
  })
})
