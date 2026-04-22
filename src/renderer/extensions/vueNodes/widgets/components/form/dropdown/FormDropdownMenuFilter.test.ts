import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { FilterOption } from '@/platform/assets/types/filterTypes'

vi.mock('@/platform/assets/composables/useModelUpload', async () => {
  const { ref } = await import('vue')
  const isUploadButtonEnabled = ref(false)
  const showUploadDialog = vi.fn()
  return {
    useModelUpload: () => ({
      isUploadButtonEnabled,
      showUploadDialog
    })
  }
})

import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'

function getUploadMock() {
  const service = useModelUpload()
  return {
    isUploadButtonEnabled:
      service.isUploadButtonEnabled as unknown as Ref<boolean>,
    showUploadDialog: vi.mocked(service.showUploadDialog)
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { import: 'Import' } } }
})

const ButtonStub = {
  inheritAttrs: false,
  template: '<button v-bind="$attrs"><slot /></button>'
}

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
  beforeEach(() => {
    const upload = getUploadMock()
    upload.isUploadButtonEnabled.value = false
    upload.showUploadDialog.mockReset()
  })

  describe('Filter options', () => {
    it('renders a button for each option', () => {
      renderMenu()
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mine' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Shared' })).toBeInTheDocument()
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
      getUploadMock().isUploadButtonEnabled.value = false
      renderMenu(singleOption)
      expect(screen.queryByRole('button', { name: /Import/i })).toBeNull()
    })

    it('is hidden when there are multiple filter options, even if upload enabled', () => {
      getUploadMock().isUploadButtonEnabled.value = true
      renderMenu(options)
      expect(screen.queryByRole('button', { name: /Import/i })).toBeNull()
    })

    it('is shown when upload is enabled and there is a single option', () => {
      getUploadMock().isUploadButtonEnabled.value = true
      renderMenu(singleOption)
      expect(
        screen.getByRole('button', { name: /Import/i })
      ).toBeInTheDocument()
    })

    it('calls showUploadDialog when the import button is clicked', async () => {
      const upload = getUploadMock()
      upload.isUploadButtonEnabled.value = true
      renderMenu(singleOption)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Import/i }))
      expect(upload.showUploadDialog).toHaveBeenCalledTimes(1)
    })
  })
})
