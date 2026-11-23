import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import koMessages from '@/locales/ko/main.json' with { type: 'json' }
import type { AssetDownloadWsMessage } from '@comfyorg/api-client/executionTypes'
import { taskService } from '@/platform/tasks/services/taskService'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'
import { api } from '@/scripts/api'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useDialogStore } from '@/stores/dialogStore'

import UploadModelDialog from '@/platform/assets/components/UploadModelDialog.vue'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en: enMessages, ko: koMessages },
  missingWarn: false,
  fallbackWarn: false
})

function renderDialog(
  props: InstanceType<typeof UploadModelDialog>['$props'] = {}
) {
  return render(UploadModelDialog, {
    props,
    global: { plugins: [i18n], stubs: { VideoHelpDialog: true } }
  })
}

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const lora = new File(['0123456789'], 'my_style_v2.safetensors')

type SendOptions = Parameters<typeof modelFileUploadApi.uploadModelFile>[1]

function pendingSends() {
  const sends: Array<{
    options: SendOptions
    finish: (result: ModelFileUploadResult) => void
  }> = []
  const spy = vi
    .spyOn(modelFileUploadApi, 'uploadModelFile')
    .mockImplementation(
      (_file, options) =>
        new Promise((finish) => sends.push({ options, finish }))
    )
  return { sends, spy }
}

function taskUpdate(status: AssetDownloadWsMessage['status'], error?: string) {
  api.dispatchCustomEvent('asset_download', {
    task_id: TASK_ID,
    asset_id: 'asset-1',
    asset_name: lora.name,
    bytes_total: lora.size,
    bytes_downloaded: lora.size,
    progress: 1,
    status,
    error
  })
}

const missingLora = {
  kind: 'missing-model-resolution' as const,
  missingModelName: 'my_style_v2.safetensors',
  requiredModelType: 'loras',
  replacementTargets: []
}

function uploadsOn(folders = ['checkpoints', 'loras']) {
  const flags = vi.mocked(useFeatureFlags().flags)
  flags.runtimeLibraryModelsEnabled = true
  flags.modelUploadFolders = folders
}

describe('UploadModelDialog file upload', () => {
  beforeEach(() => {
    vi.mocked(api.getModelFolders).mockResolvedValue([
      { name: 'loras', folders: [] },
      { name: 'checkpoints', folders: [] }
    ])
  })

  it('offers only the link import while the flag is off', () => {
    renderDialog()

    expect(
      screen.getByPlaceholderText(
        enMessages.assetBrowser.genericLinkPlaceholder
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Choose a file')).not.toBeInTheDocument()
  })

  it('offers a file from the computer while the flag is on', () => {
    uploadsOn()
    renderDialog()

    expect(screen.getByText('Choose a file')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(
        enMessages.assetBrowser.genericLinkPlaceholder
      )
    ).toBeInTheDocument()
  })

  it('keeps a missing-model import to links', () => {
    uploadsOn()
    renderDialog({ uploadContext: missingLora })

    expect(screen.queryByText('Choose a file')).not.toBeInTheDocument()
  })

  it('moves to the file, its type and Upload once a file is chosen, and Back returns', async () => {
    uploadsOn()
    const user = userEvent.setup()
    renderDialog()

    await user.upload(
      screen.getByTestId('upload-model-file-input'),
      new File(['0123456789'], 'my_style_v2.safetensors')
    )

    expect(screen.getByText('my_style_v2.safetensors')).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.assetBrowser.modelTypeSelectorLabel)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Choose a file')).toBeInTheDocument()
  })

  it('moves to the file, its type and Upload once a file is dropped', async () => {
    uploadsOn()
    renderDialog()
    await nextTick()
    const dropZone = screen.getByTestId('upload-model-file-input')
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(lora)

    for (const type of ['dragenter', 'drop']) {
      const event = new DragEvent(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      dropZone.dispatchEvent(event)
    }

    expect(await screen.findByText(lora.name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled()
    expect(screen.queryByText('Choose a file')).not.toBeInTheDocument()
  })

  it('says why a file that is not .safetensors was not taken', async () => {
    uploadsOn()
    const user = userEvent.setup({ applyAccept: false })
    renderDialog()

    await user.upload(
      screen.getByTestId('upload-model-file-input'),
      new File(['x'], 'notes.txt')
    )

    expect(
      screen.getByText('Only .safetensors files can be uploaded.')
    ).toBeInTheDocument()
  })

  it('offers no file option when the server lists no upload folders', () => {
    uploadsOn([])
    renderDialog()

    expect(screen.queryByText('Choose a file')).not.toBeInTheDocument()
  })

  it('offers only the types the server can store, LoRA first', async () => {
    uploadsOn(['loras', 'vae'])
    const user = userEvent.setup()
    renderDialog()

    await user.upload(
      screen.getByTestId('upload-model-file-input'),
      new File(['0123456789'], 'my_style_v2.safetensors')
    )
    const picker = screen.getByRole('combobox', {
      name: enMessages.assetBrowser.modelTypeSelectorLabel
    })
    expect(picker).toHaveTextContent('LoRA')

    await user.click(picker)
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent.trim())).toEqual([
      'LoRA',
      'vae'
    ])
  })

  it('keeps the type picker after the server refuses a type, so another can be tried', async () => {
    uploadsOn(['loras', 'vae'])
    const send = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: false, reason: 'unsupportedType' })
      .mockResolvedValueOnce({ ok: false, reason: 'failed' })
    const user = userEvent.setup()
    renderDialog()

    await user.upload(
      screen.getByTestId('upload-model-file-input'),
      new File(['0123456789'], 'my_style_v2.safetensors')
    )
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(
      await screen.findByText(
        "Cloud can't store this model type yet. Choose another type."
      )
    ).toBeInTheDocument()
    const picker = screen.getByRole('combobox', {
      name: enMessages.assetBrowser.modelTypeSelectorLabel
    })
    await user.click(picker)
    await user.click(await screen.findByRole('option', { name: 'vae' }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(send).toHaveBeenLastCalledWith(
      expect.any(File),
      expect.objectContaining({ tags: ['models', 'vae'] })
    )
  })

  describe('while a chosen file is sent', () => {
    async function startUpload() {
      uploadsOn()
      const server = pendingSends()
      const user = userEvent.setup()
      const view = renderDialog()
      await user.upload(screen.getByTestId('upload-model-file-input'), lora)
      await user.click(screen.getByRole('button', { name: 'Upload' }))
      await vi.waitFor(() => expect(server.sends).toHaveLength(1))
      return { ...server, user, view }
    }

    async function savedToLibrary() {
      const upload = await startUpload()
      upload.sends[0].finish({ ok: true, taskId: TASK_ID })
      expect(
        await screen.findByText(enMessages.assetBrowser.fileUpload.saving)
      ).toBeInTheDocument()
      return upload
    }

    it('shows how much of the file has been sent', async () => {
      const { sends } = await startUpload()

      sends[0].options.onProgress(5)

      await vi.waitFor(() =>
        expect(screen.getByRole('progressbar')).toHaveAttribute(
          'aria-valuenow',
          '50'
        )
      )
    })

    it('shows the rate and time left, then reconnecting with Cancel available', async () => {
      const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
      const { sends, user } = await startUpload()
      const status = screen.getByRole('status')
      expect(status).toBeEmptyDOMElement()
      clock.mockReturnValue(1000)
      sends[0].options.onProgress(5)
      expect(await screen.findByText('5 B/s · 1s left')).toBeInTheDocument()
      expect(status).toBeEmptyDOMElement()

      sends[0].options.onReconnecting?.(true)
      await vi.waitFor(() =>
        expect(status).toHaveTextContent('Reconnecting...')
      )
      expect(screen.getByRole('status')).toBe(status)
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '50'
      )
      expect(screen.queryByText('5 B/s · 1s left')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(sends[0].options.signal.aborted).toBe(true)
      sends[0].finish({ ok: false, reason: 'cancelled' })
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Upload canceled.'
      )
    })

    it('translates the time-left unit when the active locale changes', async () => {
      const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
      const { sends } = await startUpload()
      onTestFinished(() => {
        i18n.global.locale.value = 'en'
        sends[0].finish({ ok: false, reason: 'cancelled' })
      })
      i18n.global.locale.value = 'ko'
      clock.mockReturnValue(1000)
      sends[0].options.onProgress(5)

      expect(await screen.findByText(/1초/)).toBeInTheDocument()
    })

    it('offers a new upload after the storage session expires', async () => {
      const { sends, user } = await startUpload()
      sends[0].finish({ ok: false, reason: 'sessionExpired' })
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This upload expired. Try again to start a new upload.'
      )
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(sends).toHaveLength(2)
      sends[1].finish({ ok: false, reason: 'cancelled' })
    })

    it('stops the transfer when Cancel is pressed', async () => {
      const { sends, user } = await startUpload()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(sends[0].options.signal.aborted).toBe(true)
    })

    it('tells the caller the file was sent, then Finish closes the dialog', async () => {
      const closeDialog = vi.spyOn(useDialogStore(), 'closeDialog')
      const { user, view } = await savedToLibrary()

      expect(view.emitted('upload-success')).toEqual([
        [
          {
            filename: lora.name,
            modelType: 'loras',
            taskId: TASK_ID,
            status: 'processing'
          }
        ]
      ])
      taskUpdate('completed')
      await user.click(await screen.findByRole('button', { name: 'Finish' }))

      expect(closeDialog).toHaveBeenCalledWith({ key: 'upload-model' })
    })

    it('says the upload was canceled when its library task is canceled, and still finishes if the task completes', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      await savedToLibrary()

      await useAssetDownloadStore().cancelDownload(TASK_ID)

      expect(await screen.findByText('Upload canceled.')).toBeInTheDocument()
      taskUpdate('completed')
      expect(
        await screen.findByText(enMessages.assetBrowser.modelUploaded)
      ).toBeInTheDocument()
    })

    it('cancels a failed library task, and sends again once the cancel is confirmed', async () => {
      const cancelTask = vi
        .spyOn(taskService, 'cancelTask')
        .mockResolvedValue({ ok: true, value: 'cancelling' })
      const { sends, user, spy } = await savedToLibrary()
      taskUpdate('failed', 'Storage was busy.')

      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      await vi.waitFor(() => expect(cancelTask).toHaveBeenCalledOnce())
      expect(sends).toHaveLength(1)

      taskUpdate('cancelled')
      await vi.waitFor(() => expect(sends).toHaveLength(2))
      expect(cancelTask).toHaveBeenCalledWith(TASK_ID)
      expect(cancelTask.mock.invocationCallOrder[0]).toBeLessThan(
        spy.mock.invocationCallOrder[1]
      )
    })

    it('says it is stopping the earlier upload while that task cancels, with Cancel, and shows the upload once it stopped', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      const { sends, user } = await savedToLibrary()
      taskUpdate('failed', 'Storage was busy.')

      await user.click(await screen.findByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByText(enMessages.assetBrowser.fileUpload.stopping)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(
        screen.queryByText(`Uploading ${lora.name}`)
      ).not.toBeInTheDocument()

      taskUpdate('cancelled')
      await vi.waitFor(() => expect(sends).toHaveLength(2))
      expect(
        await screen.findByText(`Uploading ${lora.name}`)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(enMessages.assetBrowser.fileUpload.stopping)
      ).not.toBeInTheDocument()
    })

    it('sends nothing while a cancel from the progress list is pending, and finishes when the first task completes', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      const { sends, user } = await savedToLibrary()
      await useAssetDownloadStore().cancelDownload(TASK_ID)

      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      taskUpdate('completed')

      expect(
        await screen.findByText(enMessages.assetBrowser.modelUploaded)
      ).toBeInTheDocument()
      expect(sends).toHaveLength(1)
    })

    it('says the earlier upload could not be confirmed stopped when its cancel request fails, and finishes if it completes', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: false,
        error: new Error('Server returned 500')
      })
      const { sends, user } = await savedToLibrary()
      taskUpdate('failed', 'Storage was busy.')

      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      expect(
        await screen.findByText(enMessages.assetBrowser.fileUpload.notStopped)
      ).toBeInTheDocument()
      expect(screen.queryByText('Storage was busy.')).not.toBeInTheDocument()
      taskUpdate('completed')

      expect(
        await screen.findByText(enMessages.assetBrowser.modelUploaded)
      ).toBeInTheDocument()
      expect(sends).toHaveLength(1)
    })

    it('names the folder the model went to when the failed task finished after another type was picked', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: true,
        value: 'not-cancellable'
      })
      vi.spyOn(taskService, 'getTask').mockResolvedValue({
        ok: true,
        value: {
          id: TASK_ID,
          idempotency_key: 'key-1',
          task_name: 'task:upload_model',
          payload: {},
          status: 'completed',
          create_time: '2026-10-29T00:00:00Z',
          update_time: '2026-10-29T00:00:00Z'
        }
      })
      const { sends, user } = await savedToLibrary()
      taskUpdate('failed', 'Storage was busy.')
      await user.click(
        await screen.findByRole('combobox', {
          name: enMessages.assetBrowser.modelTypeSelectorLabel
        })
      )
      await user.click(
        await screen.findByRole('option', { name: 'Checkpoints' })
      )

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByText(
          'Find it in the LoRA section of the models library.'
        )
      ).toBeInTheDocument()
      expect(sends).toHaveLength(1)
    })

    it('shows the model imported, without a second upload, when the failed task finished after all', async () => {
      vi.spyOn(taskService, 'cancelTask').mockResolvedValue({
        ok: true,
        value: 'not-cancellable'
      })
      vi.spyOn(taskService, 'getTask').mockResolvedValue({
        ok: true,
        value: {
          id: TASK_ID,
          idempotency_key: 'key-1',
          task_name: 'task:upload_model',
          payload: {},
          status: 'completed',
          create_time: '2026-10-29T00:00:00Z',
          update_time: '2026-10-29T00:00:00Z'
        }
      })
      const { sends, user } = await savedToLibrary()
      taskUpdate('failed', 'Storage was busy.')

      await user.click(await screen.findByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByText(enMessages.assetBrowser.modelUploaded)
      ).toBeInTheDocument()
      expect(sends).toHaveLength(1)
    })
  })
})

class BucketRequest {
  static sent: BucketRequest[] = []
  status = 0
  range: string | null = null
  headers: Record<string, string> = {}
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  onloadend: (() => void) | null = null
  open() {}
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  getResponseHeader() {
    return this.range
  }
  send() {
    BucketRequest.sent.push(this)
  }
  abort() {
    this.onabort?.()
    this.onloadend?.()
  }
  finish(status: number, range: string | null = null) {
    this.status = status
    this.range = range
    this.onload?.()
    this.onloadend?.()
  }
  fail() {
    this.onerror?.()
    this.onloadend?.()
  }
}

describe('model import with a dropped storage connection', () => {
  it('resumes through the real transfer API and finishes in the library', async () => {
    BucketRequest.sent = []
    vi.stubGlobal('XMLHttpRequest', BucketRequest)
    vi.mocked(api.getModelFolders).mockResolvedValue([
      { name: 'loras', folders: [] }
    ])
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(
        Response.json(
          {
            upload_id: '2f4b8c1e-6a0d-4e7b-9c3a-1d5e8f7a9b20',
            upload_url: 'https://storage.example.com/session',
            method: 'PUT',
            headers: {},
            expires_at: '2026-11-13T17:00:00Z',
            max_size_bytes: 26_843_545_600,
            upload_mode: 'resumable',
            chunk_size_bytes: 4
          },
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(
        Response.json({ task_id: TASK_ID, status: 'created' }, { status: 202 })
      )
    uploadsOn()
    const user = userEvent.setup()
    renderDialog()
    await user.upload(screen.getByTestId('upload-model-file-input'), lora)
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    await vi.waitFor(() => expect(BucketRequest.sent).toHaveLength(1))
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    BucketRequest.sent[0].fail()
    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting...')
    expect(BucketRequest.sent[1].headers['Content-Range']).toBe('bytes */10')
    BucketRequest.sent[1].finish(308, 'bytes=0-1')
    await vi.advanceTimersByTimeAsync(0)
    expect(BucketRequest.sent[2].headers['Content-Range']).toBe('bytes 2-5/10')
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument()
    BucketRequest.sent[2].finish(308, 'bytes=0-5')
    await vi.advanceTimersByTimeAsync(0)
    BucketRequest.sent[3].finish(200)
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers()
    expect(
      await screen.findByText('Saving to your library...')
    ).toBeInTheDocument()
    taskUpdate('completed')
    expect(
      await screen.findByRole('button', { name: 'Finish' })
    ).toBeInTheDocument()
  })
})
