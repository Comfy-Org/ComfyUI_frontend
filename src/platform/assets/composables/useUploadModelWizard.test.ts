import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

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
    hostnames: ['civitai.com', 'civitai.red'],
    fetchMetadata: vi.fn()
  }
}))

vi.mock('@/platform/assets/importSources/huggingfaceImportSource', () => ({
  huggingfaceImportSource: {
    name: 'HuggingFace',
    hostnames: ['huggingface.co'],
    fetchMetadata: vi.fn()
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

  it('updates uploadStatus to success when async download completes', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')

    const asyncResponse: AsyncUploadResponse = {
      type: 'async',
      task: {
        task_id: 'task-123',
        status: 'created',
        message: 'Download queued'
      }
    }
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue(asyncResponse)

    const wizard = useUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    expect(wizard.uploadStatus.value).toBe('processing')

    // Simulate WebSocket: download completes
    const detail = {
      task_id: 'task-123',
      asset_id: 'asset-456',
      asset_name: 'model.safetensors',
      bytes_total: 1000,
      bytes_downloaded: 1000,
      progress: 100,
      status: 'completed' as const
    }
    const event = new CustomEvent('asset_download', { detail })
    const { api } = await import('@/scripts/api')
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1] as
      | ((e: CustomEvent) => void)
      | undefined
    expect(handler).toBeDefined()
    handler!(event)

    await nextTick()

    expect(wizard.uploadStatus.value).toBe('success')
  })

  it('updates uploadStatus to error when async download fails', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')

    const asyncResponse: AsyncUploadResponse = {
      type: 'async',
      task: {
        task_id: 'task-fail',
        status: 'created',
        message: 'Download queued'
      }
    }
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue(asyncResponse)

    const wizard = useUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/99999'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()
    expect(wizard.uploadStatus.value).toBe('processing')

    // Simulate WebSocket: download fails
    const { api } = await import('@/scripts/api')
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1] as
      | ((e: CustomEvent) => void)
      | undefined

    const failEvent = new CustomEvent('asset_download', {
      detail: {
        task_id: 'task-fail',
        asset_id: '',
        asset_name: 'model.safetensors',
        bytes_total: 1000,
        bytes_downloaded: 500,
        progress: 50,
        status: 'failed' as const,
        error: 'Network error'
      }
    })

    expect(handler).toBeDefined()
    handler!(failEvent)

    await nextTick()

    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadError.value).toBe('Network error')
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
