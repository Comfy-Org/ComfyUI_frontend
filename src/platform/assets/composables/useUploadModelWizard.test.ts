import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AsyncUploadResponse } from '@/platform/assets/schemas/assetSchema'
import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import { taskService } from '@/platform/tasks/services/taskService'
import { api } from '@/scripts/api'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

import { useUploadModelWizard } from './useUploadModelWizard'

vi.mock<unknown>(import('@/platform/assets/services/assetService'), () => ({
  assetService: {
    getAssetMetadata: vi.fn(),
    uploadAssetAsync: vi.fn(),
    uploadAssetFromBase64: vi.fn(),
    deleteAsset: vi.fn()
  }
}))

vi.mock<unknown>(
  import('@/platform/assets/importSources/civitaiImportSource'),
  () => ({
    civitaiImportSource: {
      name: 'Civitai',
      hostnames: ['civitai.com', 'civitai.red'],
      fetchMetadata: vi.fn()
    }
  })
)

vi.mock<unknown>(
  import('@/platform/assets/importSources/huggingfaceImportSource'),
  () => ({
    huggingfaceImportSource: {
      name: 'HuggingFace',
      hostnames: ['huggingface.co'],
      fetchMetadata: vi.fn()
    }
  })
)

vi.mock(import('@/scripts/api'))

vi.mock<unknown>(import('@/i18n'), () => ({
  st: (_key: string, fallback: string) => fallback,
  t: (key: string) => key,
  te: () => false,
  d: (date: Date) => date.toISOString()
}))

describe('useUploadModelWizard', () => {
  const modelTypes = ref([{ name: 'Checkpoint', value: 'checkpoints' }])
  const mountedApps: App<Element>[] = []

  beforeEach(() => {
    vi.mocked(api.getServerFeature).mockImplementation(
      (_name, defaultValue) => defaultValue
    )
  })

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

  afterEach(() => {
    vi.mocked(api.getServerFeature).mockReset()
    for (const app of mountedApps.splice(0)) {
      app.unmount()
    }
  })

  it('does not start an upload after reset while preview creation is pending', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    let finishPreview!: () => void
    vi.mocked(assetService.uploadAssetFromBase64).mockReturnValue(
      new Promise((resolve) => {
        finishPreview = () => resolve(fromPartial({ id: 'preview-id' }))
      })
    )

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/stale-preview'
    wizard.wizardData.value.previewImage = 'data:image/png;base64,cHJldmlldw=='
    wizard.selectedModelType.value = 'checkpoints'

    const upload = wizard.uploadModel()
    await vi.waitFor(() => {
      expect(assetService.uploadAssetFromBase64).toHaveBeenCalledOnce()
    })
    wizard.resetWizard()
    finishPreview()

    await expect(upload).resolves.toBeNull()
    expect(assetService.uploadAssetAsync).not.toHaveBeenCalled()
    expect(assetService.deleteAsset).toHaveBeenCalledWith('preview-id')
    expect(wizard.currentStep.value).toBe(1)
    expect(wizard.isUploading.value).toBe(false)
  })

  it('does not reopen a reset wizard after a synchronous refresh finishes', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: fromPartial({
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      })
    })
    let finishRefresh!: () => void
    const refreshPending = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    vi.spyOn(useModelToNodeStore(), 'getAllNodeProviders').mockReturnValue([
      fromPartial({ nodeDef: { name: 'CheckpointLoaderSimple' } })
    ])
    vi.spyOn(useAssetsStore(), 'updateModelsForNodeType').mockReturnValue(
      refreshPending
    )

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/sync'
    wizard.selectedModelType.value = 'checkpoints'
    const upload = wizard.uploadModel()
    await vi.waitFor(() => {
      expect(useAssetsStore().updateModelsForNodeType).toHaveBeenCalledOnce()
    })

    wizard.resetWizard()
    finishRefresh()

    await expect(upload).resolves.toBeNull()
    expect(wizard.currentStep.value).toBe(1)
  })

  it('tracks a backend task that resolves after the wizard is reset', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    let finishUpload!: (value: AsyncUploadResponse) => void
    vi.mocked(assetService.uploadAssetAsync).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve
      })
    )

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/stale-response'
    wizard.selectedModelType.value = 'checkpoints'

    const upload = wizard.uploadModel()
    await vi.waitFor(() => {
      expect(assetService.uploadAssetAsync).toHaveBeenCalledOnce()
    })
    wizard.resetWizard()
    finishUpload({
      type: 'async',
      task: {
        task_id: 'task-after-reset',
        status: 'created',
        message: 'Download queued'
      }
    })

    await expect(upload).resolves.toBeNull()
    expect(useAssetDownloadStore().downloadList).toEqual([
      expect.objectContaining({
        taskId: 'task-after-reset',
        modelType: 'checkpoints'
      })
    ])
    expect(wizard.currentStep.value).toBe(1)
  })

  it('refreshes model caches when a synchronous import finishes after reset', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    let finishUpload!: (value: AsyncUploadResponse) => void
    vi.mocked(assetService.uploadAssetAsync).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve
      })
    )
    vi.spyOn(useModelToNodeStore(), 'getAllNodeProviders').mockReturnValue([
      fromPartial({ nodeDef: { name: 'CheckpointLoaderSimple' } })
    ])
    const refresh = vi
      .spyOn(useAssetsStore(), 'updateModelsForNodeType')
      .mockResolvedValue(undefined)

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/stale-sync'
    wizard.selectedModelType.value = 'checkpoints'
    const upload = wizard.uploadModel()
    await vi.waitFor(() => {
      expect(assetService.uploadAssetAsync).toHaveBeenCalledOnce()
    })
    wizard.resetWizard()
    finishUpload({
      type: 'sync',
      asset: fromPartial({
        id: 'asset-after-reset',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      })
    })

    await expect(upload).resolves.toBeNull()
    expect(refresh).toHaveBeenCalledWith('CheckpointLoaderSimple')
    expect(wizard.currentStep.value).toBe(1)
  })

  it('does not let a stale failure overwrite a replacement upload', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    let failFirstUpload!: (error: Error) => void
    vi.mocked(assetService.uploadAssetAsync)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          failFirstUpload = reject
        })
      )
      .mockResolvedValueOnce({
        type: 'async',
        task: {
          task_id: 'replacement-task',
          status: 'created',
          message: 'Download queued'
        }
      })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/first'
    wizard.selectedModelType.value = 'checkpoints'
    const staleUpload = wizard.uploadModel()
    await vi.waitFor(() => {
      expect(assetService.uploadAssetAsync).toHaveBeenCalledOnce()
    })

    wizard.resetWizard()
    wizard.wizardData.value.url = 'https://civitai.com/models/replacement'
    wizard.selectedModelType.value = 'checkpoints'
    await expect(wizard.uploadModel()).resolves.toMatchObject({
      taskId: 'replacement-task',
      status: 'processing'
    })

    failFirstUpload(new Error('stale failure'))
    await expect(staleUpload).resolves.toBeNull()
    expect(wizard.uploadStatus.value).toBe('processing')
    expect(wizard.uploadError.value).toBe('')
    expect(wizard.currentStep.value).toBe(3)
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
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1]
    assert.exists(handler)
    handler(event)

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
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.find((c) => c[0] === 'asset_download')?.[1]

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

    assert.exists(handler)
    handler(failEvent)

    await nextTick()

    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadError.value).toBe('Network error')
  })

  it('keeps watching a new upload while the previous completion refreshes', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync)
      .mockResolvedValueOnce({
        type: 'async',
        task: {
          task_id: 'task-first',
          status: 'created',
          message: 'Download queued'
        }
      })
      .mockResolvedValueOnce({
        type: 'async',
        task: {
          task_id: 'task-second',
          status: 'created',
          message: 'Download queued'
        }
      })

    let finishRefresh: (() => void) | undefined
    const refreshPending = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    const assetsStore = useAssetsStore()
    const modelToNodeStore = useModelToNodeStore()
    vi.spyOn(modelToNodeStore, 'getAllNodeProviders').mockReturnValue([
      fromPartial({ nodeDef: { name: 'CheckpointLoaderSimple' } })
    ])
    vi.spyOn(assetsStore, 'updateModelsForNodeType').mockReturnValueOnce(
      refreshPending
    )

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/first'
    wizard.selectedModelType.value = 'checkpoints'
    await wizard.uploadModel()

    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.findLast((call) => call[0] === 'asset_download')?.[1]
    assert.exists(handler)
    handler(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-first',
          asset_id: 'asset-first',
          asset_name: 'first.safetensors',
          bytes_total: 1000,
          bytes_downloaded: 1000,
          progress: 100,
          status: 'completed'
        }
      })
    )
    await nextTick()

    wizard.wizardData.value.url = 'https://civitai.com/models/second'
    await wizard.uploadModel()
    expect(wizard.uploadStatus.value).toBe('processing')

    finishRefresh?.()
    await refreshPending
    await nextTick()

    handler(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-second',
          asset_id: 'asset-second',
          asset_name: 'second.safetensors',
          bytes_total: 1000,
          bytes_downloaded: 1000,
          progress: 100,
          status: 'completed'
        }
      })
    )

    await vi.waitFor(() => {
      expect(wizard.uploadStatus.value).toBe('success')
    })
  })

  it('recovers a provisionally cancelled upload when it completes authoritatively', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'async',
      task: {
        task_id: 'task-cancelled',
        status: 'created',
        message: 'Download queued'
      }
    })

    const assetsStore = useAssetsStore()
    const modelToNodeStore = useModelToNodeStore()
    vi.spyOn(modelToNodeStore, 'getAllNodeProviders').mockReturnValue([
      fromPartial({ nodeDef: { name: 'CheckpointLoaderSimple' } })
    ])
    const updateModels = vi
      .spyOn(assetsStore, 'updateModelsForNodeType')
      .mockResolvedValue()
    vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
      ok: true,
      value: 'cancelling'
    })

    const wizard = setupUploadModelWizard(modelTypes)
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'
    wizard.selectedModelType.value = 'checkpoints'
    await wizard.uploadModel()

    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.findLast((call) => call[0] === 'asset_download')?.[1]
    assert.exists(handler)

    await useAssetDownloadStore().cancelDownload('task-cancelled')
    await nextTick()

    expect(wizard.uploadStatus.value).toBe('error')
    expect(wizard.uploadError.value).toBe('Cancelled')

    handler(
      new CustomEvent('asset_download', {
        detail: {
          task_id: 'task-cancelled',
          asset_id: 'asset-late',
          asset_name: 'model.safetensors',
          bytes_total: 1000,
          bytes_downloaded: 1000,
          progress: 100,
          status: 'completed'
        }
      })
    )
    await vi.waitFor(() => {
      expect(wizard.uploadStatus.value).toBe('success')
      expect(updateModels).toHaveBeenCalledWith('CheckpointLoaderSimple')
    })
  })

  it.for([
    { label: 'premature failure', status: 'failed', error: 'Network error' },
    { label: 'confirmed cancellation', status: 'cancelled', error: undefined }
  ] as const)(
    'recovers an upload reported as a $label when it later completes',
    async ({ status, error }) => {
      const { assetService } =
        await import('@/platform/assets/services/assetService')
      const taskId = `task-recover-${status}`
      vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
        type: 'async',
        task: { task_id: taskId, status: 'created', message: 'Download queued' }
      })

      const assetsStore = useAssetsStore()
      const modelToNodeStore = useModelToNodeStore()
      vi.spyOn(modelToNodeStore, 'getAllNodeProviders').mockReturnValue([
        fromPartial({ nodeDef: { name: 'CheckpointLoaderSimple' } })
      ])
      const updateModels = vi
        .spyOn(assetsStore, 'updateModelsForNodeType')
        .mockResolvedValue()

      const wizard = setupUploadModelWizard(modelTypes)
      wizard.wizardData.value.url = 'https://civitai.com/models/12345'
      wizard.selectedModelType.value = 'checkpoints'
      await wizard.uploadModel()

      const handler = vi
        .mocked(api.addEventListener)
        .mock.calls.findLast((call) => call[0] === 'asset_download')?.[1]
      assert.exists(handler)

      function dispatchDownload(
        detail: Partial<AssetDownloadWsMessage> &
          Pick<AssetDownloadWsMessage, 'status'>
      ) {
        handler!(
          new CustomEvent('asset_download', {
            detail: {
              task_id: taskId,
              asset_id: '',
              asset_name: 'model.safetensors',
              bytes_total: 1000,
              bytes_downloaded: 500,
              progress: 50,
              ...detail
            }
          })
        )
      }

      dispatchDownload({ status, error })
      await nextTick()
      expect(wizard.uploadStatus.value).toBe('error')

      // The download store keeps `failed` recheckable and lets an
      // authoritative `completed` replace a confirmed `cancelled`, so the
      // wizard must still be watching to follow it out of the error state.
      dispatchDownload({
        status: 'completed',
        asset_id: 'asset-late',
        bytes_downloaded: 1000,
        progress: 100
      })

      await vi.waitFor(() => {
        expect(wizard.uploadStatus.value).toBe('success')
        expect(wizard.uploadError.value).toBe('')
        expect(updateModels).toHaveBeenCalledWith('CheckpointLoaderSimple')
      })
    }
  )

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
      asset: fromPartial({
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      })
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
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: fromPartial({
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'model_type:checkpoints']
      })
    })
    vi.mocked(api.getServerFeature).mockImplementation((name, defaultValue) =>
      name === 'supports_model_type_tags' ? true : defaultValue
    )

    const wizard = setupUploadModelWizard(modelTypes, {
      requiredModelType: 'checkpoints'
    })
    wizard.wizardData.value.url = 'https://civitai.com/models/12345'

    await wizard.uploadModel()

    const uploadArg = vi.mocked(assetService.uploadAssetAsync).mock.calls[0][0]
    expect(uploadArg.tags).toEqual(['models', 'model_type:checkpoints'])
    expect(uploadArg.user_metadata?.model_type).toBe('checkpoints')
    // The namespaced returned tag must not trip the required-type guard.
    expect(wizard.uploadTypeMismatch.value).toBeNull()
  })

  it('returns the synced asset filename for sync imports', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: fromPartial({
        id: 'asset-canonical',
        name: 'asset-record-display-name.safetensors',
        tags: ['models', 'checkpoints'],
        user_metadata: {
          filename: 'models/checkpoints/canonical-model.safetensors'
        }
      })
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
      asset: fromPartial({
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'loras']
      })
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
      asset: fromPartial({
        id: 'asset-1',
        name: 'model.safetensors',
        tags: ['models', 'model_type:checkpoints']
      })
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
      asset: fromPartial({
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'model_type:loras']
      })
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
      asset: fromPartial({
        id: 'asset-lora',
        name: 'model.safetensors',
        tags: ['models', 'loras']
      })
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
