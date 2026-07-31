import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SelectOption } from '@/components/ui/select/types'
import type { TemplateSortMode } from '@/composables/useTemplateFiltering'

import TemplateFilterControls from './TemplateFilterControls.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        multiSelectDropdown: 'Multi-select dropdown',
        singleSelectDropdown: 'Single-select dropdown',
        noResultsFound: 'No results found',
        search: 'Search',
        clearAll: 'Clear all'
      },
      templateWorkflows: { sorting: 'Sort by' }
    }
  }
})

const modelOptions: SelectOption[] = [
  { name: 'Flux', value: 'flux' },
  { name: 'SDXL', value: 'sdxl' }
]

const sortOptions: SelectOption[] = [
  { name: 'Default', value: 'default' },
  { name: 'Newest', value: 'newest' }
]

function renderControls() {
  const selectedModels = ref<SelectOption[]>([])
  const sortSelection = ref<TemplateSortMode>('default')

  const Parent = {
    components: { TemplateFilterControls },
    template: `
      <TemplateFilterControls
        v-model:selected-models="selectedModels"
        v-model:sort-selection="sortSelection"
        :selected-use-cases="[]"
        :selected-runs-on="[]"
        :model-search-text="''"
        :model-options="modelOptions"
        :use-case-options="[]"
        :runs-on-options="[]"
        :sort-options="sortOptions"
        model-filter-label="Model Filter"
        use-case-filter-label="Use Case"
        runs-on-filter-label="Runs On"
      />
    `,
    setup() {
      return { selectedModels, sortSelection, modelOptions, sortOptions }
    }
  }

  const { unmount } = render(Parent, { global: { plugins: [i18n] } })
  return { unmount, selectedModels, sortSelection }
}

describe('TemplateFilterControls', () => {
  it('renders a trigger for each filter', () => {
    const { unmount } = renderControls()

    expect(
      screen.getByRole('button', { name: 'Model Filter' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use Case' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Runs On' })).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Sort by' })
    ).toBeInTheDocument()

    unmount()
  })

  it('propagates a model selection to the parent', async () => {
    const user = userEvent.setup()
    const { unmount, selectedModels } = renderControls()

    await user.click(screen.getByRole('button', { name: 'Model Filter' }))
    await nextTick()
    await user.click(screen.getByText('Flux'))
    await nextTick()

    expect(selectedModels.value).toEqual([{ name: 'Flux', value: 'flux' }])

    unmount()
  })

  it('propagates a sort selection to the parent', async () => {
    const user = userEvent.setup()
    const { unmount, sortSelection } = renderControls()

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await nextTick()
    await user.click(screen.getByText('Newest'))
    await nextTick()

    expect(sortSelection.value).toBe('newest')

    unmount()
  })
})
