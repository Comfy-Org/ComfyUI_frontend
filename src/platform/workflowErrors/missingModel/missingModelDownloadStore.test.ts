import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import { downloadModel } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'

vi.mock(import('@/platform/workflowErrors/missingModel/missingModelDownload'), {
  spy: true
})
vi.mock(import('@comfyorg/telemetry/reportError'))

const model = {
  name: 'model.safetensors',
  url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
  directory: 'checkpoints'
}

const progressListeners: ((progress: ComfyDownloadProgress) => void)[] = []

function emitHostProgress(
  status: ComfyDownloadProgress['status'],
  overrides: Partial<ComfyDownloadProgress> = {}
) {
  const event: ComfyDownloadProgress = {
    id: 'job-1',
    url: model.url,
    filename: model.name,
    directory: model.directory,
    progress: status === 'completed' ? 1 : 0,
    status,
    ...overrides
  }
  for (const listener of progressListeners) listener(event)
}

const hostDownloadModel =
  vi.fn<
    (url: string, filename: string, directory: string) => Promise<boolean>
  >()

function seedMissingModel() {
  useMissingModelStore().setMissingModels([
    fromPartial<MissingModelCandidate>({
      name: model.name,
      directory: model.directory,
      isMissing: true
    })
  ])
}

function settleRefresh() {
  const missingModelStore = useMissingModelStore()
  missingModelStore.isRefreshingMissingModels = true
  return nextTick().then(() => {
    missingModelStore.isRefreshingMissingModels = false
    return nextTick()
  })
}

function installDesktopHost() {
  hostDownloadModel.mockReset().mockImplementation(async () => {
    emitHostProgress('pending', {
      id: `host-job-${hostDownloadModel.mock.calls.length}`
    })
    return true
  })
  window.__comfyDesktop2 = {
    isRemote: () => false,
    downloadModel: hostDownloadModel,
    onDownloadProgress: (listener) => {
      progressListeners.push(listener)
      return () => {}
    }
  }
}

describe(useMissingModelDownloadStore, () => {
  beforeEach(() => {
    delete window.__comfyDesktop2
    progressListeners.length = 0
    vi.mocked(downloadModel).mockImplementation(() => {})
  })

  it('downloads through the existing path when the host reports no progress', () => {
    const missingModelStore = useMissingModelStore()
    const store = useMissingModelDownloadStore()

    store.download(model)

    expect(downloadModel).toHaveBeenCalledWith(
      model,
      missingModelStore.folderPaths
    )
    expect(store.stateFor(model).status).toBe('idle')
  })

  it('re-checks missing models after a refresh that was already running when a download completed', async () => {
    installDesktopHost()
    const missingModelStore = useMissingModelStore()
    const refreshMissingModels = vi
      .spyOn(missingModelStore, 'refreshMissingModels')
      .mockResolvedValue(undefined)
    missingModelStore.setMissingModels([
      fromPartial<MissingModelCandidate>({
        name: model.name,
        directory: model.directory,
        isMissing: true
      })
    ])
    missingModelStore.isRefreshingMissingModels = true
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('pending')
    emitHostProgress('completed')
    await nextTick()

    expect(store.stateFor(model).status).toBe('done')
    expect(refreshMissingModels).not.toHaveBeenCalled()

    missingModelStore.isRefreshingMissingModels = false
    await nextTick()

    expect(refreshMissingModels).toHaveBeenCalledOnce()
  })
  it('mirrors a download of the same destination started elsewhere', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', {
      receivedBytes: 256,
      totalBytes: 1024
    })

    expect(store.stateFor(model)).toEqual({
      status: 'downloading',
      paused: false,
      receivedBytes: 256,
      totalBytes: 1024,
      fraction: 0.25
    })
  })

  it('ignores a rejected download from another source while one is running', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', { receivedBytes: 256, totalBytes: 1024 })
    emitHostProgress('error', {
      id: 'job-2',
      url: 'https://huggingface.co/other/repo/resolve/main/model.safetensors'
    })

    expect(store.stateFor(model).status).toBe('downloading')
  })

  it('does not request a model again while its download is running', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('pending')
    store.download(model)

    expect(hostDownloadModel).toHaveBeenCalledOnce()
  })
  it('downloads through the existing path while host progress is not being tracked', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()

    store.download(model)

    expect(downloadModel).toHaveBeenCalledOnce()
    expect(hostDownloadModel).not.toHaveBeenCalled()
  })

  it('keeps a retry running when an earlier job reports late', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('pending', { id: 'job-1' })
    emitHostProgress('error', { id: 'job-1' })
    store.download(model)
    emitHostProgress('downloading', { id: 'job-2' })
    emitHostProgress('cancelled', { id: 'job-1' })

    expect(store.stateFor(model).status).toBe('downloading')
  })

  it('keeps a finished download finished when its own events arrive late', () => {
    installDesktopHost()
    seedMissingModel()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('completed', { id: 'job-1' })
    emitHostProgress('downloading', { id: 'job-1' })

    expect(store.stateFor(model).status).toBe('done')
  })

  it('matches an event without a directory by source and file name', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('pending', { directory: undefined })

    expect(store.stateFor(model).status).toBe('pending')
  })

  it('does not start a second download to a destination another source is writing', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading', {
      url: 'https://huggingface.co/other/repo/resolve/main/model.safetensors'
    })

    store.download(model)

    expect(hostDownloadModel).not.toHaveBeenCalled()
  })

  it('does not fail a retry when the earlier request is refused late', async () => {
    installDesktopHost()
    let refuse: (accepted: boolean) => void = () => {}
    const refusal = new Promise<boolean>((resolve) => {
      refuse = resolve
    })
    hostDownloadModel.mockReturnValueOnce(refusal)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('error', { id: 'job-1' })
    store.download(model)
    refuse(false)
    await refusal
    await nextTick()

    expect(store.stateFor(model).status).toBe('pending')
  })

  it('re-checks a model the host accepts without reporting progress because the file is already present', async () => {
    installDesktopHost()
    seedMissingModel()
    const refreshMissingModels = vi
      .spyOn(useMissingModelStore(), 'refreshMissingModels')
      .mockResolvedValue(undefined)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    hostDownloadModel.mockResolvedValueOnce(true)

    store.download(model)
    await vi.waitFor(() => expect(store.stateFor(model).status).toBe('done'))

    expect(refreshMissingModels).toHaveBeenCalledOnce()
  })

  it('ignores a status the host does not document', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', { id: 'job-1' })
    emitHostProgress(
      fromAny<ComfyDownloadProgress['status'], unknown>('verifying'),
      { id: 'job-1' }
    )

    expect(store.stateFor(model).status).toBe('downloading')
  })

  it('reports a download the host fails to start', async () => {
    installDesktopHost()
    const failure = new Error('host refused')
    hostDownloadModel.mockRejectedValueOnce(failure)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    await vi.waitFor(() => expect(store.stateFor(model).status).toBe('failed'))

    expect(reportError).toHaveBeenCalledWith(failure, {
      surface: 'platform',
      errorType: 'error_starting_model_download',
      tags: { host: 'desktop2' }
    })
  })
  it('keeps a finished download that no missing model needs', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('completed')

    expect(store.stateFor(model).status).toBe('done')
  })

  it('reopens a finished download once a scan reports it missing again', async () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('completed')

    seedMissingModel()
    await nextTick()

    expect(store.stateFor(model).status).toBe('idle')
  })

  it('keeps a just-finished download while its re-check runs', async () => {
    installDesktopHost()
    seedMissingModel()
    const missingModelStore = useMissingModelStore()
    vi.spyOn(missingModelStore, 'refreshMissingModels').mockImplementation(
      () => {
        missingModelStore.isRefreshingMissingModels = true
        return new Promise(() => {})
      }
    )
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('completed')

    seedMissingModel()
    await nextTick()

    expect(store.stateFor(model).status).toBe('done')
  })

  it('clears a finished download once any re-check settles', async () => {
    installDesktopHost()
    seedMissingModel()
    vi.spyOn(useMissingModelStore(), 'refreshMissingModels').mockReturnValue(
      new Promise(() => {})
    )
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('completed')

    await settleRefresh()

    expect(store.stateFor(model).status).toBe('idle')
  })

  it('keeps a download that finished during an in-flight re-check until the next one', async () => {
    installDesktopHost()
    seedMissingModel()
    const missingModelStore = useMissingModelStore()
    vi.spyOn(missingModelStore, 'refreshMissingModels').mockReturnValue(
      new Promise(() => {})
    )
    const store = useMissingModelDownloadStore()
    store.startTracking()
    missingModelStore.isRefreshingMissingModels = true
    await nextTick()

    emitHostProgress('completed')
    missingModelStore.isRefreshingMissingModels = false
    await nextTick()

    expect(store.stateFor(model).status).toBe('done')
  })

  it('drops running downloads when host progress stops being tracked', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    const stopTracking = store.startTracking()
    emitHostProgress('downloading')

    stopTracking()

    expect(store.stateFor(model).status).toBe('idle')
  })

  it('shows a destination another source is writing on the model that targets it', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', {
      url: 'https://huggingface.co/other/repo/resolve/main/model.safetensors'
    })

    expect(store.stateFor(model).status).toBe('downloading')
  })
  it('keeps a finished download finished when a late event carries no job id', () => {
    installDesktopHost()
    seedMissingModel()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('completed')
    emitHostProgress('downloading', { id: undefined })

    expect(store.stateFor(model).status).toBe('done')
  })

  it('does not request a model again once its download finished', () => {
    installDesktopHost()
    seedMissingModel()
    vi.spyOn(useMissingModelStore(), 'refreshMissingModels').mockReturnValue(
      new Promise(() => {})
    )
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('completed')

    store.download(model)

    expect(hostDownloadModel).not.toHaveBeenCalled()
  })

  it('does not re-check missing models when an unrelated download finishes', () => {
    installDesktopHost()
    seedMissingModel()
    const refreshMissingModels = vi
      .spyOn(useMissingModelStore(), 'refreshMissingModels')
      .mockResolvedValue(undefined)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('completed', {
      filename: 'other.safetensors',
      url: 'https://huggingface.co/comfy/test/resolve/main/other.safetensors'
    })

    expect(refreshMissingModels).not.toHaveBeenCalled()
  })

  it('forgets failed downloads and reports an unsubscribe that throws', () => {
    installDesktopHost()
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      onDownloadProgress: (listener) => {
        progressListeners.push(listener)
        return () => {
          throw new Error('unsubscribe failed')
        }
      }
    }
    const store = useMissingModelDownloadStore()
    const stopTracking = store.startTracking()
    emitHostProgress('error')

    stopTracking()

    expect(store.stateFor(model).status).toBe('idle')
    expect(reportError).toHaveBeenCalledWith(new Error('unsubscribe failed'), {
      surface: 'platform',
      errorType: 'error_stopping_model_download_tracking'
    })
  })

  it('treats received bytes beyond the total as an unknown total', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', {
      progress: 0.4,
      receivedBytes: 2048,
      totalBytes: 1024
    })

    expect(store.stateFor(model)).toMatchObject({ fraction: 0.4 })
  })
  it('follows a running job from another source once a request joins it', () => {
    installDesktopHost()
    hostDownloadModel.mockResolvedValueOnce(true)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('downloading', {
      id: 'template-job',
      url: 'https://huggingface.co/other/repo/resolve/main/model.safetensors'
    })

    expect(store.stateFor(model).status).toBe('downloading')
  })

  it('keeps an ended job ended when a late event carries no job id', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('error', { id: undefined })
    emitHostProgress('downloading', { id: undefined })

    expect(store.stateFor(model).status).toBe('failed')
  })

  it('offers the download again after the user cancels it', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    emitHostProgress('pending')
    emitHostProgress('cancelled')

    expect(store.stateFor(model).status).toBe('idle')
  })
  it('follows a new job without an id that starts after an earlier one ended', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('error', { id: undefined })
    emitHostProgress('pending', { id: undefined })

    expect(store.stateFor(model).status).toBe('pending')
  })

  it('keeps following a running job after an event without an id ends another attempt', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    emitHostProgress('downloading', { id: 'job-1' })
    emitHostProgress('error', { id: undefined })
    emitHostProgress('downloading', { id: 'job-1' })

    expect(store.stateFor(model).status).toBe('downloading')
  })

  it('stops applying host progress after tracking stops even if unsubscribing fails', () => {
    installDesktopHost()
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      onDownloadProgress: (listener) => {
        progressListeners.push(listener)
        return () => {
          throw new Error('unsubscribe failed')
        }
      }
    }
    const store = useMissingModelDownloadStore()
    store.startTracking()()

    emitHostProgress('downloading')

    expect(store.stateFor(model).status).toBe('idle')
  })
  it('controls a download without a job id by its source URL', () => {
    installDesktopHost()
    const pauseDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, pauseDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading', { id: undefined })

    store.pause(model)

    expect(pauseDownload).toHaveBeenCalledWith(model.url)
  })

  it('reports a download control the host rejects', async () => {
    installDesktopHost()
    const failure = new Error('cannot cancel')
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      cancelDownload: vi.fn().mockRejectedValue(failure)
    }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading')

    store.cancel(model)

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'platform',
        errorType: 'error_controlling_model_download',
        tags: { action: 'cancelDownload' }
      })
    )
  })
  it('keeps a finished download no missing model needs when a re-check settles', async () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('completed')

    await settleRefresh()

    expect(store.stateFor(model).status).toBe('done')
  })

  it('offers only the controls the host provides', () => {
    installDesktopHost()
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      cancelDownload: vi.fn().mockResolvedValue(true)
    }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading')

    expect(store.canControl(model, 'cancelDownload')).toBe(true)
    expect(store.canControl(model, 'pauseDownload')).toBe(false)
  })

  it('reports a download control that throws', () => {
    installDesktopHost()
    const failure = new Error('bridge gone')
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      pauseDownload: () => {
        throw failure
      }
    }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading')

    store.pause(model)

    expect(reportError).toHaveBeenCalledWith(failure, {
      surface: 'platform',
      errorType: 'error_controlling_model_download',
      tags: { action: 'pauseDownload' }
    })
  })

  it('controls a later job without an id by URL rather than the ended job id', () => {
    installDesktopHost()
    const pauseDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, pauseDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('error', { id: 'job-1' })
    emitHostProgress('pending', { id: undefined })

    store.pause(model)

    expect(pauseDownload).toHaveBeenCalledWith(model.url)
  })
  it('stops addressing a job by id once it ends without an id', () => {
    installDesktopHost()
    const pauseDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, pauseDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading', { id: 'job-1' })
    emitHostProgress('error', { id: undefined })
    emitHostProgress('pending', { id: undefined })

    store.pause(model)

    expect(pauseDownload).toHaveBeenCalledWith(model.url)
  })

  it('does not control by a source URL that another running destination shares', () => {
    installDesktopHost()
    const pauseDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, pauseDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading', { id: undefined })
    emitHostProgress('downloading', { id: undefined, directory: 'clip' })

    store.pause(model)

    expect(pauseDownload).not.toHaveBeenCalled()
  })
  it('can cancel a request before the host reports on it', async () => {
    installDesktopHost()
    hostDownloadModel.mockReturnValueOnce(new Promise(() => {}))
    const cancelDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, cancelDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    store.cancel(model)

    expect(cancelDownload).toHaveBeenCalledWith(model.url)
    await vi.waitFor(() => expect(store.stateFor(model).status).toBe('idle'))
  })
  it('keeps a request the host refused to cancel and reports the refusal', async () => {
    installDesktopHost()
    hostDownloadModel.mockReturnValueOnce(new Promise(() => {}))
    window.__comfyDesktop2 = {
      ...window.__comfyDesktop2,
      cancelDownload: vi.fn().mockResolvedValue(false)
    }
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    store.cancel(model)

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        surface: 'platform',
        errorType: 'error_controlling_model_download',
        tags: { action: 'cancelDownload' }
      })
    )
    expect(store.stateFor(model).status).toBe('requested')
  })

  it('keeps a request whose cancel the host does not confirm', async () => {
    installDesktopHost()
    hostDownloadModel.mockReturnValueOnce(new Promise(() => {}))
    const cancelDownload = vi.fn().mockResolvedValue(undefined)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, cancelDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)
    store.cancel(model)
    await vi.waitFor(() => expect(cancelDownload).toHaveBeenCalledOnce())
    await nextTick()

    expect(store.stateFor(model).status).toBe('requested')
  })

  it('sends one control at a time for a download', async () => {
    installDesktopHost()
    let settle: (accepted: boolean) => void = () => {}
    const cancelDownload = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve
        })
    )
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, cancelDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('downloading')

    store.cancel(model)
    store.cancel(model)

    expect(cancelDownload).toHaveBeenCalledOnce()
    expect(store.canControl(model, 'cancelDownload')).toBe(false)
    settle(true)
    await vi.waitFor(() =>
      expect(store.canControl(model, 'cancelDownload')).toBe(true)
    )
  })

  it('keeps a finished download while a re-check is pending even if another view finds it missing', () => {
    installDesktopHost()
    seedMissingModel()
    vi.spyOn(useMissingModelStore(), 'refreshMissingModels').mockReturnValue(
      new Promise(() => {})
    )
    const store = useMissingModelDownloadStore()
    store.startTracking()
    useMissingModelStore().isRefreshingMissingModels = true
    emitHostProgress('completed')

    store.reopenFinished([model])

    expect(store.stateFor(model).status).toBe('done')
  })

  it('finishes an already-present file that no missing model needs', async () => {
    installDesktopHost()
    hostDownloadModel.mockResolvedValueOnce(true)
    const store = useMissingModelDownloadStore()
    store.startTracking()

    store.download(model)

    await vi.waitFor(() => expect(store.stateFor(model).status).toBe('done'))
  })
})
