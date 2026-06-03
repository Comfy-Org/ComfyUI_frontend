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
  messages: {
    en: {
      g: { import: 'Import' },
      widgets: { uploadSelect: { importMedia: 'Import media' } }
    }
  }
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
  modelValue: string | undefined = 'all',
  extraProps: Record<string, unknown> = {},
  onFileChange: (event: Event) => void = () => {}
) {
  const value = ref<string | undefined>(modelValue)
  const Harness = defineComponent({
    components: { FormDropdownMenuFilter },
    setup: () => ({ value, filterOptions, extraProps, onFileChange }),
    template:
      '<FormDropdownMenuFilter v-model:filter-selected="value" :filter-options="filterOptions" v-bind="extraProps" @file-change="onFileChange" />'
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

    it('renders the single option as a non-interactive title', () => {
      renderMenu(singleOption)
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
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

  describe('Media import button', () => {
    it('shows an Import media button when uploadable with multiple options', () => {
      renderMenu(options, 'all', { uploadable: true })
      expect(
        screen.getByRole('button', { name: 'Import media' })
      ).toBeInTheDocument()
    })

    it('is hidden when not uploadable', () => {
      renderMenu(options, 'all', { uploadable: false })
      expect(screen.queryByRole('button', { name: 'Import media' })).toBeNull()
    })

    it('defers to the model import button for a single filter option', () => {
      getUploadMock().isUploadButtonEnabled.value = true
      renderMenu(singleOption, 'all', { uploadable: true })
      expect(screen.queryByRole('button', { name: 'Import media' })).toBeNull()
      expect(
        screen.getByRole('button', { name: /Import/i })
      ).toBeInTheDocument()
    })

    it('emits file-change when a file is selected', async () => {
      const onFileChange = vi.fn()
      renderMenu(
        options,
        'all',
        { uploadable: true, accept: 'image/*' },
        onFileChange
      )
      await userEvent
        .setup()
        .upload(
          screen.getByTestId('media-upload-input'),
          new File(['x'], 'a.png', { type: 'image/png' })
        )
      expect(onFileChange).toHaveBeenCalled()
    })
  })
})
