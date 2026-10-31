import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'
import type { AssetDownloadWsMessage } from '@comfyorg/api-client/executionTypes'
import {
  TaskNotFoundError,
  taskService
} from '@/platform/tasks/services/taskService'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'

import { useUploadModelFile } from './useUploadModelFile'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const lora = new File(['0123456789'], 'my_style_v2.safetensors')

type UploadOptions = Parameters<typeof modelFileUploadApi.uploadModelFile>[1]

const mountedApps: App<Element>[] = []

function setup() {
  let upload: ReturnType<typeof useUploadModelFile> | undefined
  const app = createApp({
    setup() {
      upload = useUploadModelFile()
      return () => null
    }
  })
  app.use(
    createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })
  )
  app.mount(document.createElement('div'))
  mountedApps.push(app)
  if (!upload) throw new Error('composable did not run')
  return { upload, app }
}

function pendingUpload() {
  let options: UploadOptions | undefined
  let finish!: (result: ModelFileUploadResult) => void
  vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
    (_file, opts) => {
      options = opts
      return new Promise((resolve) => {
        finish = resolve
      })
    }
  )
  return {
    options: () => {
      if (!options) throw new Error('upload not started')
      return options
    },
    finish: (result: ModelFileUploadResult) => finish(result)
  }
}

function taskUpdate(
  status: AssetDownloadWsMessage['status'],
  error?: string,
  taskId = TASK_ID
) {
  const listener = vi
    .mocked(api.addEventListener)
    .mock.calls.findLast(([type]) => type === 'asset_download')?.[1]
  if (typeof listener !== 'function') throw new Error('no download listener')
  listener(
    new CustomEvent('asset_download', {
      detail: {
        task_id: taskId,
        asset_id: 'asset-1',
        asset_name: lora.name,
        bytes_total: lora.size,
        bytes_downloaded: lora.size,
        progress: 1,
        status,
        error
      }
    })
  )
}

describe('useUploadModelFile', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockImplementation(() => undefined)
    const flags = vi.mocked(useFeatureFlags().flags)
    flags.modelUploadFolders = ['checkpoints', 'loras']
  })

  afterEach(() => {
    for (const app of mountedApps.splice(0)) app.unmount()
  })

  it('refuses a file that is not .safetensors before any upload', () => {
    const { upload } = setup()
    const spy = vi.spyOn(modelFileUploadApi, 'uploadModelFile')

    upload.choose(new File(['x'], 'notes.txt'))

    expect(upload.state.value).toEqual({
      status: 'idle',
      error: 'Only .safetensors files can be uploaded.'
    })
    upload.choose(new File(['x'], 'STYLE.SAFETENSORS'))
    expect(upload.state.value.status).toBe('chosen')
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows bytes sent, then saving, then done once the library task finishes', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    expect(server.options().tags).toEqual(['models', 'loras'])
    server.options().onProgress(4)
    expect(upload.state.value).toEqual({
      status: 'uploading',
      file: lora,
      sent: 4
    })

    server.finish({ ok: true, taskId: TASK_ID })
    await expect(result).resolves.toEqual({
      filename: lora.name,
      modelType: 'loras',
      taskId: TASK_ID,
      status: 'processing'
    })
    expect(upload.state.value.status).toBe('saving')

    taskUpdate('completed')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'done',
      file: lora,
      modelType: 'loras'
    })
    expect(useAssetDownloadStore().downloadList[0]?.source).toBe('upload')
    expect(useAssetDownloadStore().lastCompletedDownload).toMatchObject({
      taskId: TASK_ID,
      modelType: 'loras'
    })
  })

  it('uploads into the folder the person picked', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    upload.modelType.value = 'checkpoints'

    const result = upload.upload()

    expect(server.options().tags).toEqual(['models', 'checkpoints'])
    server.finish({ ok: true, taskId: TASK_ID })
    await expect(result).resolves.toMatchObject({ modelType: 'checkpoints' })
  })

  it('stops the transfer on cancel and says so, without reporting an error', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    upload.cancel()
    expect(server.options().signal.aborted).toBe(true)
    server.finish({ ok: false, reason: 'cancelled' })

    await expect(result).resolves.toBeNull()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      error: 'Upload canceled.'
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed upload and offers to try again', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: false, reason: 'failed', cause: 'storage 403' })

    await expect(result).resolves.toBeNull()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      error: 'Upload failed. Try again.'
    })
    expect(reportError).toHaveBeenCalledWith(
      'storage 403',
      expect.objectContaining({ errorType: 'error_uploading_model_file' })
    )

    const retry = pendingUpload()
    const retried = upload.upload()
    expect(retry.options().tags).toEqual(['models', 'loras'])
    retry.finish({ ok: true, taskId: TASK_ID })
    await expect(retried).resolves.toMatchObject({ taskId: TASK_ID })
  })

  it("shows the server's size limit when the file is too large", async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({
      ok: false,
      reason: 'tooLarge',
      message: 'Files can be up to 2 GB.'
    })

    await result
    expect(upload.state.value).toMatchObject({
      status: 'failed',
      error: 'Files can be up to 2 GB.'
    })
  })

  it('asks for another type when the server cannot store the chosen one', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: false, reason: 'unsupportedType' })

    await result
    expect(upload.state.value).toMatchObject({
      status: 'failed',
      error: "Cloud can't store this model type yet. Choose another type."
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    ['privateModelsDisabled', "Your plan doesn't include private models."],
    ['planUnavailable', "Couldn't check your plan. Try again."],
    ['unsupportedFile', 'Only .safetensors files can be uploaded.']
  ] as const)(
    'says what the server refused when it answers %s',
    async ([reason, copy]) => {
      const { upload } = setup()
      const server = pendingUpload()
      upload.choose(lora)

      const result = upload.upload()
      server.finish({ ok: false, reason })

      await result
      expect(upload.state.value).toEqual({
        status: 'failed',
        file: lora,
        error: copy
      })
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('offers only the folders the server accepts, LoRA first when listed', () => {
    const { upload } = setup()

    upload.choose(lora)

    expect(upload.uploadFolders.value).toEqual(['checkpoints', 'loras'])
    expect(upload.modelType.value).toBe('loras')
  })

  it('starts on the first accepted folder when LoRA is not one of them', () => {
    vi.mocked(useFeatureFlags().flags).modelUploadFolders = [
      'checkpoints',
      'vae'
    ]
    const { upload } = setup()

    upload.choose(lora)

    expect(upload.modelType.value).toBe('checkpoints')
  })

  it('starts each newly chosen file on the default type again', () => {
    const { upload } = setup()
    upload.choose(lora)
    upload.modelType.value = 'checkpoints'

    upload.choose(new File(['x'], 'portrait.safetensors'))

    expect(upload.modelType.value).toBe('loras')
  })

  it('is offered exactly while the server lists upload folders', () => {
    const flags = vi.mocked(useFeatureFlags().flags)
    flags.runtimeLibraryModelsEnabled = false
    const { upload } = setup()
    expect(upload.isAvailable.value).toBe(true)

    flags.modelUploadFolders = []
    expect(upload.isAvailable.value).toBe(false)
  })

  it('shows why the library task failed after the bytes arrived', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result

    taskUpdate('failed', 'This file is not a valid .safetensors file.')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: 'This file is not a valid .safetensors file.'
    })
  })

  it('refreshes the model lists when the library task finishes before the upload call answers', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    taskUpdate('completed')
    server.finish({ ok: true, taskId: TASK_ID })
    await result
    await nextTick()

    expect(upload.state.value).toEqual({
      status: 'done',
      file: lora,
      modelType: 'loras'
    })
    expect(useAssetDownloadStore().lastCompletedDownload).toMatchObject({
      taskId: TASK_ID,
      modelType: 'loras'
    })
  })

  it('stops saving when the server no longer has the library task', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.spyOn(taskService, 'getTask').mockResolvedValue({
      ok: false,
      error: new TaskNotFoundError(TASK_ID)
    })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result
    await vi.advanceTimersByTimeAsync(30_000)

    expect(useAssetDownloadStore().downloadList[0]?.status).toBe('failed')
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: enMessages.progressToast.taskUnavailable
    })
  })

  it('says the upload was canceled when the library task is canceled', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result

    taskUpdate('cancelled')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: 'Upload canceled.'
    })
  })

  it('says the upload was canceled when the cancel is never confirmed, and finishes if the task completes after its row is dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
      ok: true,
      value: 'cancelling'
    })
    vi.spyOn(taskService, 'getTask').mockResolvedValue({
      ok: true,
      value: {
        id: TASK_ID,
        idempotency_key: 'upload-1',
        task_name: 'task:download_file',
        payload: {},
        status: 'running',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      }
    })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result
    taskUpdate('running')

    const downloads = useAssetDownloadStore()
    await downloads.cancelDownload(TASK_ID)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(downloads.downloadList[0]?.status).toBe('cancellation_unconfirmed')
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: 'Upload canceled.'
    })

    downloads.clearDismissibleDownloads()
    expect(downloads.downloadList).toEqual([])
    taskUpdate('completed')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'done',
      file: lora,
      modelType: 'loras'
    })
  })

  it('keeps saving when a different import finishes', async () => {
    const otherImport = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f'
    const { upload } = setup()
    taskUpdate('running', undefined, otherImport)
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result

    taskUpdate('completed', undefined, otherImport)
    await nextTick()
    expect(upload.state.value).toEqual({ status: 'saving', file: lora })
  })

  it('says the earlier upload could not be confirmed stopped, and sends nothing, when its cancel request fails', async () => {
    const refused = new Error('Server returned 500')
    vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
      ok: false,
      error: refused
    })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('failed', 'Storage was busy.')
    await nextTick()

    await expect(upload.upload()).resolves.toBeNull()

    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: enMessages.assetBrowser.fileUpload.notStopped
    })
    expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      refused,
      expect.objectContaining({
        errorType: 'asset_download_cancellation_failure'
      })
    )
  })

  it('sends nothing while the failed task is still running after its cancel is refused, and finishes when it completes', async () => {
    vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
      ok: true,
      value: 'not-cancellable'
    })
    vi.spyOn(taskService, 'getTask').mockResolvedValue({
      ok: true,
      value: {
        id: TASK_ID,
        idempotency_key: 'upload-1',
        task_name: 'task:upload_model',
        payload: {},
        status: 'running',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      }
    })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('failed', 'Storage was busy.')
    await nextTick()

    await expect(upload.upload()).resolves.toBeNull()

    expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledOnce()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: enMessages.assetBrowser.fileUpload.notStopped
    })
    taskUpdate('completed')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'done',
      file: lora,
      modelType: 'loras'
    })
  })

  it('sends the file again when the canceled task was dismissed from the progress list', async () => {
    const cancelTask = vi.spyOn(taskService, 'cancelTask')
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('cancelled')
    await nextTick()

    useAssetDownloadStore().clearDismissibleDownloads()
    const retried = upload.upload()

    await vi.waitFor(() =>
      expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledTimes(2)
    )
    expect(cancelTask).not.toHaveBeenCalled()
    expect(upload.state.value).toEqual({
      status: 'uploading',
      file: lora,
      sent: 0
    })
    server.finish({ ok: false, reason: 'cancelled' })
    await expect(retried).resolves.toBeNull()
  })

  it('cancels a failed task that was dismissed from the progress list, and sends again once the cancel is confirmed', async () => {
    const cancelTask = vi
      .spyOn(taskService, 'cancelTask')
      .mockResolvedValue({ ok: true, value: 'cancelling' })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('failed', 'Storage was busy.')
    await nextTick()
    const downloads = useAssetDownloadStore()

    downloads.clearDismissibleDownloads()
    const retried = upload.upload()

    await vi.waitFor(() => expect(cancelTask).toHaveBeenCalledWith(TASK_ID))
    await vi.waitFor(() =>
      expect(downloads.downloadList[0]?.status).toBe('cancellation_pending')
    )
    expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledOnce()
    expect(upload.state.value).toEqual({ status: 'stopping', file: lora })

    taskUpdate('cancelled')
    await vi.waitFor(() =>
      expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledTimes(2)
    )
    expect(upload.state.value).toEqual({
      status: 'uploading',
      file: lora,
      sent: 0
    })
    server.finish({ ok: false, reason: 'cancelled' })
    await expect(retried).resolves.toBeNull()
  })

  it('stops Try again when Cancel is pressed while the earlier task is being canceled, and still finishes if that task completes', async () => {
    let answerCancel!: (answer: 'cancelling') => void
    vi.spyOn(taskService, 'cancelTask').mockImplementation(
      () =>
        new Promise((resolve) => {
          answerCancel = (value) => resolve({ ok: true, value })
        })
    )
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('failed', 'Storage was busy.')
    await nextTick()

    const retry = upload.upload()
    await vi.waitFor(() => expect(answerCancel).toBeTypeOf('function'))
    upload.cancel()
    answerCancel('cancelling')

    await expect(retry).resolves.toBeNull()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: 'Upload canceled.'
    })
    expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledOnce()

    taskUpdate('completed')
    await nextTick()
    expect(upload.state.value).toEqual({
      status: 'done',
      file: lora,
      modelType: 'loras'
    })
  })

  it('stops Try again when Cancel is pressed while waiting for the earlier task to confirm its cancel', async () => {
    vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
      ok: true,
      value: 'cancelling'
    })
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const first = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await first
    taskUpdate('failed', 'Storage was busy.')
    await nextTick()

    const retry = upload.upload()
    await vi.waitFor(() =>
      expect(useAssetDownloadStore().downloadList[0]?.status).toBe(
        'cancellation_pending'
      )
    )
    upload.cancel()

    await expect(retry).resolves.toBeNull()
    expect(upload.state.value).toEqual({
      status: 'failed',
      file: lora,
      taskId: TASK_ID,
      error: 'Upload canceled.'
    })
    expect(modelFileUploadApi.uploadModelFile).toHaveBeenCalledOnce()
  })

  it('stops the earlier transfer when another file is chosen', async () => {
    const otherFile = new File(['01234'], 'teammate_style.safetensors')
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    upload.choose(otherFile)
    server.options().onProgress(4)
    server.finish({ ok: true, taskId: TASK_ID })

    await expect(result).resolves.toBeNull()
    expect(server.options().signal.aborted).toBe(true)
    expect(upload.state.value).toEqual({ status: 'chosen', file: otherFile })
  })

  it('stops following the earlier library task when another file is chosen', async () => {
    const otherFile = new File(['01234'], 'teammate_style.safetensors')
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)
    const result = upload.upload()
    server.finish({ ok: true, taskId: TASK_ID })
    await result

    upload.choose(otherFile)
    taskUpdate('completed')
    await nextTick()

    expect(upload.state.value).toEqual({ status: 'chosen', file: otherFile })
  })

  it('ignores an upload that answers after the person went back', async () => {
    const { upload } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    const signal = server.options().signal
    upload.reset()
    server.finish({ ok: true, taskId: TASK_ID })

    await expect(result).resolves.toBeNull()
    expect(signal.aborted).toBe(true)
    expect(upload.state.value).toEqual({ status: 'idle' })
  })

  it('stops the transfer when the dialog closes', async () => {
    const { upload, app } = setup()
    const server = pendingUpload()
    upload.choose(lora)

    const result = upload.upload()
    app.unmount()
    mountedApps.splice(0)

    expect(server.options().signal.aborted).toBe(true)
    server.finish({ ok: false, reason: 'cancelled' })
    await expect(result).resolves.toBeNull()
  })
})
