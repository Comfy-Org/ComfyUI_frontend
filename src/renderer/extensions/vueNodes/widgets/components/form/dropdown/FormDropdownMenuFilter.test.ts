/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-reserved-component-names */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { FilterOption } from '@/platform/assets/types/filterTypes'

const mocks = vi.hoisted(
  () =>
    ({
      isEnabled: false,
      showUploadDialog: (() => {}) as () => void
    }) as { isEnabled: boolean; showUploadDialog: () => void }
)

vi.mock('@/platform/assets/composables/useModelUpload', async () => {
  const { computed } = await import('vue')
  return {
    useModelUpload: () => ({
      isUploadButtonEnabled: computed(() => mocks.isEnabled),
      showUploadDialog: mocks.showUploadDialog
    })
  }
})

import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { import: 'Import' } } }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  template: '<button v-bind="$attrs"><slot /></button>'
})

const options: FilterOption[] = [
  { value: 'all', name: 'All' },
  { value: 'mine', name: 'Mine' },
  { value: 'shared', name: 'Shared' }
]

const singleOption: FilterOption[] = [{ value: 'all', name: 'All' }]

function renderMenu(
  filterOptions: FilterOption[] = options,
  modelValue: string | undefined = 'all'
) {
  const value = ref<string | undefined>(modelValue)
  const Harness = defineComponent({
    components: { FormDropdownMenuFilter },
    setup: () => ({ value, filterOptions }),
    template:
      '<FormDropdownMenuFilter v-model:filter-selected="value" :filter-options="filterOptions" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub }
    }
  })
  return { ...utils, value }
}

describe('FormDropdownMenuFilter', () => {
  let showDialogSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.isEnabled = false
    showDialogSpy = vi.fn()
    mocks.showUploadDialog = showDialogSpy as unknown as () => void
  })

  describe('Filter options', () => {
    it('renders a button for each option', () => {
      renderMenu()
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mine' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Shared' })
      ).toBeInTheDocument()
    })

    it('updates v-model when an option is clicked', async () => {
      const { value } = renderMenu(options, 'all')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Mine' }))
      expect(value.value).toBe('mine')
    })

    it('disables option buttons when there is only one option', () => {
      renderMenu(singleOption)
      expect(screen.getByRole('button', { name: 'All' })).toBeDisabled()
    })

    it('does not disable buttons when there are multiple options', () => {
      renderMenu()
      expect(screen.getByRole('button', { name: 'All' })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Mine' })).not.toBeDisabled()
    })
  })

  describe('Upload button', () => {
    it('is hidden when upload button flag is disabled', () => {
      mocks.isEnabled = false
      renderMenu(singleOption)
      expect(screen.queryByRole('button', { name: /Import/i })).toBeNull()
    })

    it('is hidden when there are multiple filter options, even if upload enabled', () => {
      mocks.isEnabled = true
      renderMenu(options)
      expect(screen.queryByRole('button', { name: /Import/i })).toBeNull()
    })

    it('is shown when upload is enabled and there is a single option', () => {
      mocks.isEnabled = true
      renderMenu(singleOption)
      expect(
        screen.getByRole('button', { name: /Import/i })
      ).toBeInTheDocument()
    })

    it('calls showUploadDialog when the import button is clicked', async () => {
      mocks.isEnabled = true
      renderMenu(singleOption)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Import/i }))
      expect(showDialogSpy).toHaveBeenCalledTimes(1)
    })
  })
})
