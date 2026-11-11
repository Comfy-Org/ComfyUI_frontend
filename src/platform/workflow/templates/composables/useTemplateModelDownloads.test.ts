import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  toTemplateModelDownloadState,
  useTemplateModelDownloads
} from '@/platform/workflow/templates/composables/useTemplateModelDownloads'
import { useTemplateModelRowDownloads } from '@/platform/workflow/templates/composables/useTemplateModelRowDownloads'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'

vi.mock(
  import('@/platform/workflow/templates/composables/useTemplateModelRowDownloads'),
  { spy: true }
)

const model = {
  name: 'model.safetensors',
  url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
  directory: 'checkpoints'
}

const progressListeners: ((progress: ComfyDownloadProgress) => void)[] = []
const hostDownloadModel =
  vi.fn<
    (url: string, filename: string, directory: string) => Promise<boolean>
  >()

function emitHostProgress(progress: ComfyDownloadProgress) {
  for (const listener of progressListeners) listener(progress)
}

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

describe(useTemplateModelDownloads, () => {
  beforeEach(() => {
    delete window.__comfyDesktop2
    progressListeners.length = 0
  })

  it('shares Desktop 2 downloads with the missing-model store', () => {
    installDesktopHost()
    useMissingModelDownloadStore().startTracking()
    const downloads = useTemplateModelDownloads({ folderPaths: {} })

    emitHostProgress({
      id: 'canvas-job',
      url: model.url,
      filename: model.name,
      directory: model.directory,
      status: 'downloading',
      progress: 0.5
    })
    downloads.request(model)

    expect(downloads.stateFor(model)).toMatchObject({
      status: 'downloading',
      fraction: 0.5
    })
    expect(hostDownloadModel).not.toHaveBeenCalled()
    expect(useTemplateModelRowDownloads).not.toHaveBeenCalled()
  })

  it('keeps a dialog-scoped tracker on hosts that report no progress', () => {
    useTemplateModelDownloads({ folderPaths: { checkpoints: ['/models'] } })

    expect(useTemplateModelRowDownloads).toHaveBeenCalledWith({
      folderPaths: { checkpoints: ['/models'] }
    })
  })

  it('keeps a dialog-scoped tracker while host progress is not being tracked', () => {
    installDesktopHost()

    useTemplateModelDownloads({ folderPaths: {} })

    expect(useTemplateModelRowDownloads).toHaveBeenCalledOnce()
  })

  it('reopens a finished download the dialog finds missing', () => {
    installDesktopHost()
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress({
      id: 'job-1',
      url: model.url,
      filename: model.name,
      directory: model.directory,
      status: 'completed',
      progress: 1
    })

    const downloads = useTemplateModelDownloads({ folderPaths: {} }, [model])

    expect(downloads.stateFor(model).status).toBe('idle')
  })
})

describe(toTemplateModelDownloadState, () => {
  it.for([
    { from: { status: 'idle' }, to: { status: 'idle', attempt: 0 } },
    { from: { status: 'requested' }, to: { status: 'queued', attempt: 1 } },
    { from: { status: 'pending' }, to: { status: 'starting', attempt: 1 } },
    { from: { status: 'done' }, to: { status: 'done', attempt: 1 } },
    {
      from: { status: 'failed' },
      to: { status: 'failed', attempt: 1, reason: 'error' }
    },
    {
      from: {
        status: 'downloading',
        paused: true,
        receivedBytes: 1,
        totalBytes: 4,
        fraction: 0.25
      },
      to: {
        status: 'downloading',
        attempt: 1,
        activity: 'paused',
        receivedBytes: 1,
        totalBytes: 4,
        fraction: 0.25
      }
    }
  ] as const)('maps $from.status to $to.status', ({ from, to }) => {
    expect(toTemplateModelDownloadState(from)).toEqual(to)
  })
})
