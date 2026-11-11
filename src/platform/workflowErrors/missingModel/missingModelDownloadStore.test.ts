import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { downloadModel } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'

vi.mock(import('@/platform/workflowErrors/missingModel/missingModelDownload'), {
  spy: true
})

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
})
