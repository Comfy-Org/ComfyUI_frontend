import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AsyncUploadResponse } from '@/platform/assets/schemas/assetSchema'

import { useUploadModelWizard } from './useUploadModelWizard'

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    uploadAssetAsync: vi.fn(),
    uploadAssetPreviewImage: vi.fn()
  }
}))

vi.mock('@/platform/assets/importSources/civitaiImportSource', () => ({
  civitaiImportSource: {
    name: 'Civitai',
    hostnames: ['civitai.com', 'civitai.red']
  }
}))

vi.mock('@/platform/assets/importSources/huggingfaceImportSource', () => ({
  huggingfaceImportSource: {
    name: 'HuggingFace',
    hostnames: ['huggingface.co']
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    apiURL: vi.fn((path: string) => path)
  }
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback,
  t: (key: string) => key,
  te: () => false,
  d: (date: Date) => date.toISOString()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('useUploadModelWizard', () => {
  const modelTypes = ref([{ name: 'Checkpoint', value: 'checkpoints' }])

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('accepts civitai.red model URLs', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')

    const asyncResponse: AsyncUploadResponse = {
      type: 'async',
      task: {
        task_id: 'task-red',
        status: 'created',
        message: 'Download queued'
      }
    }
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue(asyncResponse)

    const wizard = useUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.red/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    expect(assetService.uploadAssetAsync).toHaveBeenCalled()
    expect(wizard.uploadStatus.value).toBe('processing')
  })
})
