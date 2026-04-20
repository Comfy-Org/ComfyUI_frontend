import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'

const mockValidateComfyUISource = vi.fn()
const mockShowDirectoryPicker = vi.fn()

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => ({
    validateComfyUISource: mockValidateComfyUISource,
    showDirectoryPicker: mockShowDirectoryPicker
  }))
}))

import MigrationPicker from '@/components/install/MigrationPicker.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      install: {
        migrationSourcePathDescription: 'Source path description',
        migrationOptional: 'Migration is optional',
        selectItemsToMigrate: 'Select items to migrate',
        pathValidationFailed: 'Validation failed',
        failedToSelectDirectory: 'Failed to select directory',
        locationPicker: {
          migrationPathPlaceholder: 'Enter path'
        }
      }
    }
  }
})

const InputTextStub = {
  props: ['modelValue', 'invalid'],
  emits: ['update:modelValue'],
  template: `<input
    data-testid="source-input"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />`
}

const CheckboxStub = {
  props: ['modelValue', 'inputId', 'binary'],
  emits: ['update:modelValue', 'click'],
  template: `<input
    type="checkbox"
    :data-testid="'checkbox-' + inputId"
    :checked="modelValue"
    @change="$emit('update:modelValue', $event.target.checked)"
    @click.stop="$emit('click')"
  />`
}

function renderPicker(sourcePath = '', migrationItemIds: string[] = []) {
  return render(MigrationPicker, {
    props: { sourcePath, migrationItemIds },
    global: {
      plugins: [[PrimeVue, { unstyled: true }], i18n],
      stubs: {
        InputText: InputTextStub,
        Checkbox: CheckboxStub,
        Button: { template: '<button data-testid="browse-btn" />' },
        Message: {
          props: ['severity'],
          template: '<div data-testid="error-msg"><slot /></div>'
        }
      }
    }
  })
}

describe('MigrationPicker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('isValidSource', () => {
    it('hides migration options when source path is empty', () => {
      renderPicker('')
      expect(screen.queryByText('Select items to migrate')).toBeNull()
    })

    it('shows migration options when source path is valid', async () => {
      mockValidateComfyUISource.mockResolvedValue({ isValid: true })
      const { rerender } = renderPicker('')

      await rerender({ sourcePath: '/valid/path' })
      await waitFor(() => {
        expect(screen.getByText('Select items to migrate')).toBeDefined()
      })
    })

    it('shows optional message when no valid source', () => {
      renderPicker('')
      expect(screen.getByText('Migration is optional')).toBeDefined()
    })
  })

  describe('validateSource', () => {
    it('clears error when source path becomes empty', async () => {
      mockValidateComfyUISource.mockResolvedValue({
        isValid: false,
        error: 'Not found'
      })

      const user = userEvent.setup()
      renderPicker()

      await user.type(screen.getByTestId('source-input'), '/bad/path')
      await waitFor(() => {
        expect(screen.getByTestId('error-msg')).toBeDefined()
      })

      await user.clear(screen.getByTestId('source-input'))
      await waitFor(() => {
        expect(screen.queryByTestId('error-msg')).toBeNull()
      })
    })

    it('shows error message when validation fails', async () => {
      mockValidateComfyUISource.mockResolvedValue({
        isValid: false,
        error: 'Path not found'
      })

      const user = userEvent.setup()
      renderPicker()

      await user.type(screen.getByTestId('source-input'), '/bad/path')
      await waitFor(() => {
        expect(screen.getByTestId('error-msg')).toBeDefined()
      })
    })

    it('shows no error when validation passes', async () => {
      mockValidateComfyUISource.mockResolvedValue({ isValid: true })

      const user = userEvent.setup()
      renderPicker()

      await user.type(screen.getByTestId('source-input'), '/valid/path')
      await waitFor(() => {
        expect(screen.queryByTestId('error-msg')).toBeNull()
      })
    })
  })

  describe('migrationItemIds watchEffect', () => {
    it('emits all item IDs by default (all items start selected)', async () => {
      const onUpdate = vi.fn()
      render(MigrationPicker, {
        props: {
          sourcePath: '',
          migrationItemIds: [],
          'onUpdate:migrationItemIds': onUpdate
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }], i18n],
          stubs: {
            InputText: InputTextStub,
            Checkbox: CheckboxStub,
            Button: { template: '<button />' },
            Message: { template: '<div />' }
          }
        }
      })

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled()
        const emittedIds = onUpdate.mock.calls[0][0]
        expect(Array.isArray(emittedIds)).toBe(true)
        expect(emittedIds.length).toBeGreaterThan(0)
      })
    })
  })

  describe('browse path', () => {
    it('opens directory picker on browse click', async () => {
      mockShowDirectoryPicker.mockResolvedValue(null)
      renderPicker()

      const user = userEvent.setup()
      await user.click(screen.getByTestId('browse-btn'))

      expect(mockShowDirectoryPicker).toHaveBeenCalledOnce()
    })

    it('updates source path when directory is selected', async () => {
      mockShowDirectoryPicker.mockResolvedValue('/selected/path')
      mockValidateComfyUISource.mockResolvedValue({ isValid: true })

      const onUpdate = vi.fn()
      render(MigrationPicker, {
        props: {
          sourcePath: '',
          'onUpdate:sourcePath': onUpdate
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }], i18n],
          stubs: {
            InputText: InputTextStub,
            Checkbox: CheckboxStub,
            Button: { template: '<button data-testid="browse-btn" />' },
            Message: { template: '<div />' }
          }
        }
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('browse-btn'))

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('/selected/path')
      })
    })
  })
})
