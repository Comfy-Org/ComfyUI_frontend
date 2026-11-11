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

function installDesktopHost() {
  hostDownloadModel.mockReset().mockResolvedValue(true)
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
      fromPartial<MissingModelCandidate>({ name: model.name, isMissing: true })
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

    expect(store.stateFor(model).status).toBe('requested')
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
})
