import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import {
  downloadMissingModels,
  cancelMissingModelDownload
} from '@/platform/remote/comfyui/modelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingModelDownloadStore } from './missingModelDownloadStore'

vi.mock(import('@/platform/remote/comfyui/modelDownload'), { spy: true })

const model = {
  name: 'model.safetensors',
  directory: 'checkpoints',
  url: 'https://huggingface.co/org/model/resolve/main/model.safetensors'
}
type DownloadResponse = Awaited<ReturnType<typeof downloadMissingModels>>
const success: DownloadResponse = {
  ok: true,
  value: {
    downloaded: 1,
    skipped: 0,
    failed: 0,
    canceled: 0,
    results: [{ ...model, status: 'downloaded' }]
  }
}

describe('missing model downloads', () => {
  beforeEach(() => {
    vi.spyOn(useMissingModelStore(), 'refreshMissingModels').mockResolvedValue()
  })

  it('deduplicates a batch, tracks progress across consumers and ignores late events', async () => {
    const response = deferred<DownloadResponse>()
    vi.mocked(downloadMissingModels).mockReturnValue(response.promise)
    const store = useMissingModelDownloadStore()
    const finished = store.start([model, model])
    expect(downloadMissingModels).toHaveBeenCalledWith(
      [model],
      expect.any(String),
      expect.any(String),
      ''
    )
    const batchId = vi.mocked(downloadMissingModels).mock.calls[0][2]
    const progress = {
      ...model,
      batch_id: batchId,
      task_id: 'task',
      status: 'running' as const,
      bytes_downloaded: 16
    }
    api.dispatchCustomEvent('missing_model_download', {
      ...progress,
      batch_id: 'another'
    })
    expect(store.stateFor(model)?.status).toBe('queued')
    api.dispatchCustomEvent('missing_model_download', progress)
    expect(useMissingModelDownloadStore().stateFor(model)).toMatchObject({
      status: 'running',
      bytesDownloaded: 16
    })
    response.resolve(success)
    await finished
    expect(store.isDownloading).toBe(false)
    expect(store.stateFor(model)?.status).toBe('completed')
    api.dispatchCustomEvent('missing_model_download', progress)
    expect(store.stateFor(model)?.status).toBe('completed')
    expect(useMissingModelStore().refreshMissingModels).toHaveBeenCalledWith({
      reloadDefs: true
    })
  })

  it('keeps cancellation pending during progress and handles a completion race', async () => {
    const response = deferred<DownloadResponse>()
    const cancellation =
      deferred<Awaited<ReturnType<typeof cancelMissingModelDownload>>>()
    vi.mocked(downloadMissingModels).mockReturnValue(response.promise)
    vi.mocked(cancelMissingModelDownload).mockReturnValue(cancellation.promise)
    const store = useMissingModelDownloadStore()
    const finished = store.start([model])
    const progress = {
      ...model,
      batch_id: vi.mocked(downloadMissingModels).mock.calls[0][2],
      task_id: 'task',
      status: 'running' as const,
      bytes_downloaded: 1
    }
    api.dispatchCustomEvent('missing_model_download', progress)
    const canceled = store.cancel(model)
    api.dispatchCustomEvent('missing_model_download', {
      ...progress,
      bytes_downloaded: 2
    })
    expect(store.stateFor(model)?.status).toBe('canceling')
    api.dispatchCustomEvent('missing_model_download', {
      ...progress,
      status: 'completed'
    })
    cancellation.resolve({
      ok: false,
      error: new Error('Task already finished')
    })
    await canceled
    expect(store.stateFor(model)?.status).toBe('completed')
    response.resolve(success)
    await finished
  })

  it('surfaces cancel errors and allows retrying a failed transfer', async () => {
    const response = deferred<DownloadResponse>()
    vi.mocked(downloadMissingModels).mockReturnValueOnce(response.promise)
    vi.mocked(cancelMissingModelDownload).mockRejectedValueOnce(
      new Error('Cancel failed')
    )
    const store = useMissingModelDownloadStore()
    const finished = store.start([model])
    api.dispatchCustomEvent('missing_model_download', {
      ...model,
      batch_id: vi.mocked(downloadMissingModels).mock.calls[0][2],
      task_id: 'task',
      status: 'running',
      bytes_downloaded: 1
    })
    await store.cancel(model)
    expect(store.stateFor(model)).toMatchObject({
      status: 'running',
      error: 'Cancel failed'
    })
    response.reject(new Error('Connection lost'))
    await finished
    expect(store.stateFor(model)).toMatchObject({
      status: 'failed',
      error: 'Connection lost'
    })
    expect(store.isDownloading).toBe(false)
    vi.mocked(downloadMissingModels).mockResolvedValue(success)
    await store.start([model])
    expect(store.stateFor(model)?.status).toBe('completed')
  })

  it('retries with the current token without retaining it in serialized state', async () => {
    const store = useMissingModelDownloadStore()
    store.setHuggingFaceToken(' hf_first ')
    expect(store.hasHuggingFaceToken).toBe(true)
    vi.mocked(downloadMissingModels).mockResolvedValue({
      ok: true,
      value: {
        downloaded: 0,
        skipped: 0,
        canceled: 0,
        failed: 1,
        results: [
          {
            ...model,
            status: 'failed',
            error_code: 'hf_authentication',
            error: 'HTTP 401'
          }
        ]
      }
    })
    await store.start([model])
    expect(downloadMissingModels).toHaveBeenLastCalledWith(
      [model],
      expect.any(String),
      expect.any(String),
      'hf_first'
    )
    expect(store.stateFor(model)?.error).toContain(
      'valid Hugging Face read token'
    )
    store.setHuggingFaceToken('hf_replacement')
    vi.mocked(downloadMissingModels).mockResolvedValue(success)
    await store.start([model])
    expect(downloadMissingModels).toHaveBeenLastCalledWith(
      [model],
      expect.any(String),
      expect.any(String),
      'hf_replacement'
    )
    expect(store.stateFor(model)?.status).toBe('completed')
    expect(JSON.stringify(store.$state)).not.toContain('hf_replacement')
    store.setHuggingFaceToken('')
    expect(store.hasHuggingFaceToken).toBe(false)
    await store.start([model])
    expect(downloadMissingModels).toHaveBeenLastCalledWith(
      [model],
      expect.any(String),
      expect.any(String),
      ''
    )
  })

  it('exposes gated access guidance from progress even when browser metadata missed it', async () => {
    const response = deferred<DownloadResponse>()
    vi.mocked(downloadMissingModels).mockReturnValue(response.promise)
    const store = useMissingModelDownloadStore()
    const finished = store.start([model])
    api.dispatchCustomEvent('missing_model_download', {
      ...model,
      batch_id: vi.mocked(downloadMissingModels).mock.calls[0][2],
      task_id: 'gated-task',
      status: 'failed',
      bytes_downloaded: 0,
      error_code: 'hf_gated',
      error: 'HTTP 403'
    })
    expect(store.stateFor(model)?.error).toContain('Once approved')
    expect(useMissingModelStore().gatedRepoUrls[model.url]).toBe(
      'https://huggingface.co/org/model'
    )
    response.resolve({ ok: false, error: new Error('Connection lost') })
    await finished
    expect(store.stateFor(model)?.error).toContain('Once approved')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
