import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
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
    uploadAssetFromBase64: vi.fn(),
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

  it('does not fetch metadata until the URL matches a supported source', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    const wizard = setupUploadModelWizard(modelTypes)

    expect(wizard.canFetchMetadata.value).toBe(false)
    await wizard.fetchMetadata()

    expect(assetService.getAssetMetadata).not.toHaveBeenCalled()
    expect(wizard.currentStep.value).toBe(1)
  })

  it('decodes metadata filenames and selects a matching model type tag', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      content_length: 100,
      final_url: 'https://huggingface.co/org/model',
      filename: '%E6%A8%A1%E5%9E%8B.safetensors',
      name: '%E5%90%8D%E7%A8%B1',
      tags: ['checkpoints'],
      preview_image: 'data:image/png;base64,abc'
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = ' https://huggingface.co/org/model '

    await wizard.fetchMetadata()

    expect(wizard.currentStep.value).toBe(2)
    expect(wizard.wizardData.value.url).toBe('https://huggingface.co/org/model')
    expect(wizard.wizardData.value.name).toBe('模型.safetensors')
    expect(wizard.wizardData.value.previewImage).toBe(
      'data:image/png;base64,abc'
    )
    expect(wizard.selectedModelType.value).toBe('checkpoints')
  })

  it('keeps metadata text when percent decoding fails', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      content_length: 100,
      final_url: 'https://civitai.com/models/12345',
      filename: '%E0%A4%A',
      name: '%E0%A4%A',
      tags: []
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    await wizard.fetchMetadata()

    expect(wizard.currentStep.value).toBe(2)
    expect(wizard.wizardData.value.name).toBe('%E0%A4%A')
    expect(wizard.selectedModelType.value).toBeUndefined()
  })

  it('uses the fallback metadata error for non-error rejections', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockRejectedValue('no metadata')

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    await wizard.fetchMetadata()

    expect(wizard.currentStep.value).toBe(1)
    expect(wizard.uploadError.value).toBe(
      'Failed to retrieve metadata. Please check the link and try again.'
    )
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

  it('clears upload errors and type mismatches when the URL changes', async () => {
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
    await wizard.uploadModel()

    expect(wizard.uploadTypeMismatch.value).not.toBeNull()

    wizard.wizardData.value.url = 'https://civitai.com/models/54321'
    await nextTick()

    expect(wizard.uploadError.value).toBe('')
    expect(wizard.uploadTypeMismatch.value).toBeNull()
  })

  it('returns null while another upload is in progress', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    type UploadResult = Awaited<
      ReturnType<typeof assetService.uploadAssetAsync>
    >
    let resolveUpload!: (value: UploadResult) => void
    vi.mocked(assetService.uploadAssetAsync).mockReturnValue(
      new Promise<UploadResult>((resolve) => {
        resolveUpload = resolve
      })
    )

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    const firstUpload = wizard.uploadModel()
    await nextTick()

    await expect(wizard.uploadModel()).resolves.toBeNull()

    resolveUpload({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      }
    })

    await expect(firstUpload).resolves.toEqual(
      expect.objectContaining({ status: 'success' })
    )
  })

  it('returns null when no model type is selected', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(assetService.uploadAssetAsync).not.toHaveBeenCalled()
  })

  it('reports an upload error when no valid source is detected', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://example.com/model'
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(assetService.uploadAssetAsync).not.toHaveBeenCalled()
  })

  it('uploads preview images and passes the preview id to the model upload', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetFromBase64).mockResolvedValue(
      fromPartial({ id: 'preview-1' })
    )
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.wizardData.value.metadata = {
      content_length: 100,
      final_url: 'https://civitai.com/models/12345',
      filename: 'model.safetensors'
    }
    wizard.wizardData.value.previewImage = 'data:image/jpeg;base64,abc'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    expect(assetService.uploadAssetFromBase64).toHaveBeenCalledWith({
      data: 'data:image/jpeg;base64,abc',
      name: 'model_preview.jpg',
      tags: ['preview']
    })
    expect(assetService.uploadAssetAsync).toHaveBeenCalledWith(
      expect.objectContaining({ preview_id: 'preview-1' })
    )
  })

  it('continues model upload when preview upload fails', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetFromBase64).mockRejectedValue(
      new Error('preview failed')
    )
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.wizardData.value.metadata = {
      content_length: 100,
      final_url: 'https://civitai.com/models/12345',
      name: 'model'
    }
    wizard.wizardData.value.previewImage = 'data:image/webp;base64,abc'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    expect(assetService.uploadAssetAsync).toHaveBeenCalledWith(
      expect.objectContaining({ preview_id: undefined })
    )
    expect(wizard.uploadStatus.value).toBe('success')
  })

  it('treats an already completed async upload as success', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'async',
      task: {
        task_id: 'task-complete',
        status: 'completed',
        message: 'Download complete'
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.wizardData.value.metadata = {
      content_length: 100,
      final_url: 'https://civitai.com/models/12345',
      filename: 'queued.safetensors'
    }
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toEqual({
      filename: 'queued.safetensors',
      modelType: 'checkpoints',
      status: 'success'
    })
    expect(wizard.uploadStatus.value).toBe('success')
  })

  it('cleans up an immediately resolved async watcher', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    const { useAssetDownloadStore } =
      await import('@/stores/assetDownloadStore')
    const assetDownloadStore = useAssetDownloadStore()
    assetDownloadStore.trackDownload(
      'task-ready',
      'checkpoints',
      'ready.safetensors'
    )
    const { api } = await import('@/scripts/api')
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1] as
      | ((e: CustomEvent) => void)
      | undefined
    expect(handler).toBeDefined()
    handler!(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-ready',
          asset_id: 'asset-ready',
          asset_name: 'ready.safetensors',
          bytes_total: 100,
          bytes_downloaded: 100,
          progress: 100,
          status: 'completed' as const
        }
      })
    )
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'async',
      task: {
        task_id: 'task-ready',
        status: 'created',
        message: 'Download queued'
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()
    await nextTick()

    expect(wizard.uploadStatus.value).toBe('success')
  })

  it('uses the default failed-download message when no error is available', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'async',
      task: {
        task_id: 'task-fallback-fail',
        status: 'created',
        message: 'Download queued'
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()

    const { api } = await import('@/scripts/api')
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1] as
      | ((e: CustomEvent) => void)
      | undefined
    expect(handler).toBeDefined()
    handler!(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-fallback-fail',
          asset_id: '',
          asset_name: '',
          bytes_total: 1000,
          bytes_downloaded: 500,
          progress: 50,
          status: 'failed' as const
        }
      })
    )

    await nextTick()

    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadError.value).toBe('assetBrowser.downloadFailed')
  })

  it('uses fallback labels for unknown mismatch types', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: {
        id: 'asset-unknown',
        name: 'model.safetensors',
        tags: ['models']
      }
    })

    const wizard = setupUploadModelWizard(modelTypes, {
      requiredModelType: 'unknown-required'
    })
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(wizard.uploadTypeMismatch.value).toEqual({
      importedModelType: undefined,
      importedModelTypeLabel: undefined,
      requiredModelType: 'unknown-required',
      requiredModelTypeLabel: 'unknown-required'
    })
  })

  it('uses a generic upload error for non-error upload failures', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockRejectedValue('failed')

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'

    const result = await wizard.uploadModel()

    expect(result).toBeNull()
    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadError.value).toBe('Failed to upload model')
  })

  it('navigates backward only after the first step', () => {
    const wizard = setupUploadModelWizard(modelTypes)

    wizard.goToPreviousStep()
    expect(wizard.currentStep.value).toBe(1)

    wizard.currentStep.value = 3
    wizard.goToPreviousStep()

    expect(wizard.currentStep.value).toBe(2)
  })

  it('resets wizard state and cancels pending async status watching', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'async',
      task: {
        task_id: 'task-reset',
        status: 'created',
        message: 'Download queued'
      }
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.wizardData.value.name = 'Model'
    wizard.wizardData.value.tags = ['checkpoints']
    wizard.selectedModelType.value = 'checkpoints'

    await wizard.uploadModel()
    wizard.resetWizard()

    expect(wizard.currentStep.value).toBe(1)
    expect(wizard.uploadStatus.value).toBeUndefined()
    expect(wizard.uploadError.value).toBe('')
    expect(wizard.wizardData.value).toEqual({
      url: '',
      name: '',
      tags: []
    })
    expect(wizard.selectedModelType.value).toBeUndefined()
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
