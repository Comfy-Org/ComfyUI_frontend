import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AsyncUploadResponse } from '@/platform/assets/schemas/assetSchema'

import { useUploadModelWizard } from './useUploadModelWizard'

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetMetadata: vi.fn(),
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
    apiURL: vi.fn((path: string) => path),
    getServerFeature: vi.fn(
      (_name: string, defaultValue?: unknown) => defaultValue
    )
  }
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback,
  t: (key: string) => key,
  te: () => false,
  d: (date: Date) => date.toISOString()
}))

describe('useUploadModelWizard', () => {
  const modelTypes = ref([{ name: 'Checkpoint', value: 'checkpoints' }])
  const mountedApps: App<Element>[] = []

  function setupWithI18n<T>(factory: () => T): T {
    let result: T | undefined
    const host = document.createElement('div')
    const app = createApp({
      setup() {
        result = factory()
        return () => null
      }
    })
    app.use(
      createI18n({
        legacy: false,
        locale: 'en',
        messages: { en: enMessages }
      })
    )
    app.mount(host)
    mountedApps.push(app)

    if (result === undefined) {
      throw new Error('Composable setup did not run')
    }
    return result
  }

  function setupUploadModelWizard(
    ...args: Parameters<typeof useUploadModelWizard>
  ): ReturnType<typeof useUploadModelWizard> {
    return setupWithI18n(() => useUploadModelWizard(...args))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    for (const app of mountedApps.splice(0)) {
      app.unmount()
    }
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

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toEqual({
      filename: 'model',
      modelType: 'checkpoints',
      taskId: 'task-123',
      status: 'processing'
    })

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

    const wizard = setupUploadModelWizard(modelTypes)
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

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.red/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    expect(assetService.uploadAssetAsync).toHaveBeenCalled()
    expect(wizard.uploadStatus.value).toBe('processing')
  })

  it('keeps a required model type when metadata suggests another type', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      content_length: 100,
      final_url: 'https://civitai.com/models/12345',
      filename: 'lora.safetensors',
      tags: ['loras']
    })

    const wizard = setupUploadModelWizard(
      ref([
        { name: 'Checkpoint', value: 'checkpoints' },
        { name: 'LoRA', value: 'loras' }
      ]),
      { requiredModelType: 'checkpoints' }
    )
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    await wizard.fetchMetadata()

    expect(wizard.selectedModelType.value).toBe('checkpoints')
  })

  it('uploads with the required model type even if selection changes', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      }
    })

    const wizard = setupUploadModelWizard(modelTypes, {
      requiredModelType: 'checkpoints'
    })
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'loras'

    const result = await wizard.uploadModel()

    expect(assetService.uploadAssetAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['models', 'checkpoints'],
        user_metadata: expect.objectContaining({
          model_type: 'checkpoints'
        })
      })
    )
    expect(result?.modelType).toBe('checkpoints')
  })

  it('namespaces the tag but keeps user_metadata.model_type bare when the backend supports it', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    const { api } = await import('@/scripts/api')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'model_type:checkpoints']
      }
    })
    vi.mocked(api.getServerFeature).mockImplementation((name, defaultValue) =>
      name === 'supports_model_type_tags' ? true : defaultValue
    )

    try {
      const wizard = setupUploadModelWizard(modelTypes, {
        requiredModelType: 'checkpoints'
      })
      wizard.wizardData.value.url = 'https://civitai.com/models/12345'

      await wizard.uploadModel()

      const uploadArg = vi.mocked(assetService.uploadAssetAsync).mock
        .calls[0][0]
      expect(uploadArg.tags).toEqual(['models', 'model_type:checkpoints'])
      expect(uploadArg.user_metadata?.model_type).toBe('checkpoints')
      // The namespaced returned tag must not trip the required-type guard.
      expect(wizard.uploadTypeMismatch.value).toBeNull()
    } finally {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_name, defaultValue) => defaultValue
      )
    }
  })

  it('returns the synced asset filename for sync imports', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-canonical',
        name: 'asset-record-display-name.safetensors',
        tags: ['models', 'checkpoints'],
        user_metadata: {
          filename: 'models/checkpoints/canonical-model.safetensors'
        }
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.wizardData.value.metadata = {
      content_length: 100,
      final_url:
        'https://civitai.com/api/download/models/canonical-model.safetensors',
      filename: 'metadata-model.safetensors',
      tags: ['checkpoints']
    }
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toEqual({
      filename: 'models/checkpoints/canonical-model.safetensors',
      modelType: 'checkpoints',
      status: 'success'
    })
  })

  it('blocks a missing-model import when an existing asset has the wrong model type', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'loras']
      }
    })

    const wizard = setupUploadModelWizard(
      ref([
        { name: 'Checkpoint', value: 'checkpoints' },
        { name: 'LoRA', value: 'loras' }
      ]),
      { requiredModelType: 'checkpoints' }
    )
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadTypeMismatch.value).toEqual({
      importedModelType: 'loras',
      importedModelTypeLabel: 'LoRA',
      requiredModelType: 'checkpoints',
      requiredModelTypeLabel: 'Checkpoint'
    })
  })

  it('treats a namespaced model_type: tag as satisfying the required type', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'model_type:checkpoints']
      }
    })

    const wizard = setupUploadModelWizard(
      ref([
        { name: 'Checkpoint', value: 'checkpoints' },
        { name: 'LoRA', value: 'loras' }
      ]),
      { requiredModelType: 'checkpoints' }
    )
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    const result = await wizard.uploadModel()

    expect(result).not.toBeNull()
    expect(wizard.uploadTypeMismatch.value).toBeNull()
  })

  it('strips the model_type: prefix from the imported-type label on a real mismatch', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'model_type:loras']
      }
    })

    const wizard = setupUploadModelWizard(
      ref([
        { name: 'Checkpoint', value: 'checkpoints' },
        { name: 'LoRA', value: 'loras' }
      ]),
      { requiredModelType: 'checkpoints' }
    )
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(wizard.uploadTypeMismatch.value).toEqual({
      importedModelType: 'loras',
      importedModelTypeLabel: 'LoRA',
      requiredModelType: 'checkpoints',
      requiredModelTypeLabel: 'Checkpoint'
    })
  })

  it('does not block sync imports as mismatches without a required model type', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'loras']
      }
    })

    const wizard = setupUploadModelWizard(
      ref([
        { name: 'Checkpoint', value: 'checkpoints' },
        { name: 'LoRA', value: 'loras' }
      ])
    )
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toEqual(
      expect.objectContaining({
        modelType: 'checkpoints',
        status: 'success'
      })
    )
    expect(wizard.uploadStatus.value).toBe('success')
    expect(wizard.uploadTypeMismatch.value).toBeNull()
  })
})
