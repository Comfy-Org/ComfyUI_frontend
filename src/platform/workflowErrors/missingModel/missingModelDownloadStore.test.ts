import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { downloadModel } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'

vi.mock(import('@/platform/workflowErrors/missingModel/missingModelDownload'), {
  spy: true
})

const model = {
  name: 'model.safetensors',
  url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
  directory: 'checkpoints'
}

const progressListeners: ((progress: ComfyDownloadProgress) => void)[] = []

function emitHostProgress(status: ComfyDownloadProgress['status']) {
  const event: ComfyDownloadProgress = {
    id: 'job-1',
    url: model.url,
    filename: model.name,
    directory: model.directory,
    progress: status === 'completed' ? 1 : 0,
    status
  }
  for (const listener of progressListeners) listener(event)
}

function installDesktopHost() {
  window.__comfyDesktop2 = {
    isRemote: () => false,
    downloadModel: vi.fn().mockResolvedValue(true),
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
    missingModelStore.isRefreshingMissingModels = true
    const store = useMissingModelDownloadStore()

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
})
