import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mockPrivateModelsEnabled = vi.hoisted(() => ({ value: true }))
const mockShowUploadDialog = vi.hoisted(() => vi.fn())
const mockHandleUrlInput = vi.hoisted(() => vi.fn())
const mockHandleImport = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get privateModelsEnabled() {
        return mockPrivateModelsEnabled.value
      }
    }
  })
}))

vi.mock('@/platform/assets/composables/useModelUpload', () => ({
  useModelUpload: () => ({
    isUploadButtonEnabled: { value: true },
    showUploadDialog: mockShowUploadDialog
  })
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    useMissingModelInteractions: () => ({
      handleUrlInput: mockHandleUrlInput,
      handleImport: mockHandleImport
    })
  })
)

vi.mock('@/components/rightSidePanel/layout/TransitionCollapse.vue', () => ({
  default: {
    name: 'TransitionCollapse',
    template: '<div><slot /></div>'
  }
}))

import MissingModelUrlInput from './MissingModelUrlInput.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { loading: 'Loading' },
      rightSidePanel: {
        missingModels: {
          urlPlaceholder: 'Paste model URL...',
          clearUrl: 'Clear URL',
          import: 'Import',
          importAnyway: 'Import Anyway',
          typeMismatch: 'Type mismatch: {detectedType}',
          unsupportedUrl: 'Unsupported URL',
          metadataFetchFailed: 'Failed to fetch metadata',
          importFailed: 'Import failed'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

const MODEL_KEY = 'supported::checkpoints::model.safetensors'

function mountComponent(
  props: Partial<{
    modelKey: string
    directory: string | null
    typeMismatch: string | null
  }> = {}
) {
  return mount(MissingModelUrlInput, {
    props: {
      modelKey: MODEL_KEY,
      directory: 'checkpoints',
      typeMismatch: null,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('MissingModelUrlInput', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrivateModelsEnabled.value = true
    mockShowUploadDialog.mockClear()
    mockHandleUrlInput.mockClear()
    mockHandleImport.mockClear()
  })

  describe('URL input is always editable', () => {
    it('input is editable when privateModelsEnabled is true', () => {
      mockPrivateModelsEnabled.value = true
      const wrapper = mountComponent()
      const input = wrapper.find('input')
      expect(input.attributes('readonly')).toBeUndefined()
    })

    it('input is editable when privateModelsEnabled is false (free tier)', () => {
      mockPrivateModelsEnabled.value = false
      const wrapper = mountComponent()
      const input = wrapper.find('input')
      expect(input.attributes('readonly')).toBeUndefined()
    })

    it('input accepts user typing when privateModelsEnabled is false', async () => {
      mockPrivateModelsEnabled.value = false
      const wrapper = mountComponent()
      const input = wrapper.find('input')
      input.element.value = 'https://example.com/model.safetensors'
      await input.trigger('input')
      expect(mockHandleUrlInput).toHaveBeenCalledWith(
        MODEL_KEY,
        'https://example.com/model.safetensors'
      )
    })
  })

  describe('Import button gates on subscription', () => {
    it('calls handleImport when privateModelsEnabled is true', async () => {
      mockPrivateModelsEnabled.value = true
      const store = useMissingModelStore()
      store.urlMetadata[MODEL_KEY] = {
        filename: 'model.safetensors',
        content_length: 1024,
        final_url: 'https://example.com/model.safetensors'
      }

      const wrapper = mountComponent()
      const importBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('Import'))
      expect(importBtn).toBeTruthy()
      await importBtn!.trigger('click')

      expect(mockHandleImport).toHaveBeenCalledWith(MODEL_KEY, 'checkpoints')
      expect(mockShowUploadDialog).not.toHaveBeenCalled()
    })

    it('calls showUploadDialog when privateModelsEnabled is false (free tier)', async () => {
      mockPrivateModelsEnabled.value = false
      const store = useMissingModelStore()
      store.urlMetadata[MODEL_KEY] = {
        filename: 'model.safetensors',
        content_length: 1024,
        final_url: 'https://example.com/model.safetensors'
      }

      const wrapper = mountComponent()
      const importBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('Import'))
      expect(importBtn).toBeTruthy()
      await importBtn!.trigger('click')

      expect(mockShowUploadDialog).toHaveBeenCalled()
      expect(mockHandleImport).not.toHaveBeenCalled()
    })

    it('clear button works for free-tier users', async () => {
      mockPrivateModelsEnabled.value = false
      const store = useMissingModelStore()
      store.urlInputs[MODEL_KEY] = 'https://example.com/model.safetensors'
      const wrapper = mountComponent()
      const clearBtn = wrapper.find('button[aria-label="Clear URL"]')
      await clearBtn.trigger('click')
      expect(mockHandleUrlInput).toHaveBeenCalledWith(MODEL_KEY, '')
    })
  })
})
