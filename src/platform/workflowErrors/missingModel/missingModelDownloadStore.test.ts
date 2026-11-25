import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { downloadModel } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import {
  refreshMissingModelPipeline,
  runMissingModelPipeline
} from '@/platform/workflowErrors/missingModel/missingModelPipeline'
import * as missingModelScan from '@/platform/workflowErrors/missingModel/missingModelScan'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

vi.mock(import('@/platform/workflowErrors/missingModel/missingModelDownload'), {
  spy: true
})
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: fromPartial<FirebaseIdentity>({
    onUserChanged: () => () => {},
    onTokenChanged: () => () => {},
    currentUser: () => null
  })
}))
vi.mock(import('@/platform/workflowErrors/missingModel/missingModelScan'), {
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

  it('re-checks missing models after a load that skips its asset scans', async () => {
    installDesktopHost()
    seedMissingModel()
    const missingModelStore = useMissingModelStore()
    const refreshMissingModels = vi
      .spyOn(missingModelStore, 'refreshMissingModels')
      .mockResolvedValue(undefined)
    const store = useMissingModelDownloadStore()
    store.startTracking()
    missingModelStore.isRefreshingMissingModels = true
    emitHostProgress('completed')
    await nextTick()

    missingModelStore.createVerificationAbortController().abort()
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

  it('resumes a paused download instead of starting another', () => {
    installDesktopHost()
    const resumeDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, resumeDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('paused')

    store.download(model)

    expect(resumeDownload).toHaveBeenCalledWith('job-1')
    expect(hostDownloadModel).not.toHaveBeenCalled()
  })

  it('does not resume a paused download of another source to the same file', () => {
    installDesktopHost()
    const resumeDownload = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = { ...window.__comfyDesktop2, resumeDownload }
    const store = useMissingModelDownloadStore()
    store.startTracking()
    emitHostProgress('paused', {
      url: 'https://huggingface.co/other/repo/resolve/main/model.safetensors'
    })

    store.download(model)

    expect(store.canResume(model)).toBe(false)
    expect(resumeDownload).not.toHaveBeenCalled()
    expect(hostDownloadModel).not.toHaveBeenCalled()
  })

  describe('after a reload', () => {
    function hostJob(
      status: ComfyDownloadProgress['status'],
      overrides: Partial<ComfyDownloadProgress> = {}
    ): ComfyDownloadProgress {
      return {
        id: 'job-1',
        url: model.url,
        filename: model.name,
        directory: model.directory,
        progress: 0.5,
        status,
        ...overrides
      }
    }

    const otherModel = {
      ...model,
      name: 'other.safetensors',
      url: `${model.url}?other`
    }

    function flushPromises() {
      return new Promise((resolve) => setTimeout(resolve))
    }

    function listJobs(jobs: Promise<ComfyDownloadProgress[]>) {
      listWithHost(() => jobs)
    }

    function listWithHost(listModelDownloads: () => unknown) {
      installDesktopHost()
      window.__comfyDesktop2 = {
        ...window.__comfyDesktop2,
        listModelDownloads: fromAny<
          () => Promise<ComfyDownloadProgress[]>,
          () => unknown
        >(listModelDownloads)
      }
    }

    it('shows a paused download the host still holds', async () => {
      listJobs(Promise.resolve([hostJob('paused')]))
      const store = useMissingModelDownloadStore()

      store.startTracking()

      await vi.waitFor(() =>
        expect(store.stateFor(model)).toMatchObject({
          status: 'downloading',
          paused: true
        })
      )
    })

    it('keeps progress that arrived before the listing', async () => {
      let resolveJobs: (jobs: ComfyDownloadProgress[]) => void = () => {}
      listJobs(new Promise((resolve) => (resolveJobs = resolve)))
      const store = useMissingModelDownloadStore()
      store.startTracking()

      emitHostProgress('downloading', { progress: 0.75 })
      resolveJobs([
        hostJob('paused'),
        hostJob('paused', {
          id: 'job-2',
          url: otherModel.url,
          filename: otherModel.name
        })
      ])
      await vi.waitFor(() =>
        expect(store.stateFor(otherModel)).toMatchObject({ paused: true })
      )

      expect(store.stateFor(model)).toMatchObject({ paused: false })
    })

    it('ignores a listing that arrives after tracking stopped', async () => {
      let resolveJobs: (jobs: ComfyDownloadProgress[]) => void = () => {}
      listJobs(new Promise((resolve) => (resolveJobs = resolve)))
      const store = useMissingModelDownloadStore()
      const stopTracking = store.startTracking()

      stopTracking()
      resolveJobs([hostJob('paused')])
      await flushPromises()

      expect(store.stateFor(model).status).toBe('idle')
    })

    it('shows a held paused download again after tracking restarts', async () => {
      listJobs(Promise.resolve([]))
      const store = useMissingModelDownloadStore()
      const stopTracking = store.startTracking()
      emitHostProgress('downloading')
      stopTracking()
      window.__comfyDesktop2 = {
        ...window.__comfyDesktop2,
        listModelDownloads: () => Promise.resolve([hostJob('paused')])
      }

      store.startTracking()

      await vi.waitFor(() =>
        expect(store.stateFor(model)).toMatchObject({ paused: true })
      )
    })

    it('prefers the held job over a finished one listed for the same file', async () => {
      listJobs(
        Promise.resolve([
          hostJob('error', { id: 'old-job' }),
          hostJob('paused')
        ])
      )
      const store = useMissingModelDownloadStore()

      store.startTracking()

      await vi.waitFor(() =>
        expect(store.stateFor(model)).toMatchObject({ paused: true })
      )
    })

    it.for([
      { listing: 'null', value: null },
      { listing: 'a set of held jobs', value: new Set([hostJob('paused')]) },
      {
        listing: 'an object wrapping held jobs',
        value: { jobs: [hostJob('paused')] }
      }
    ])(
      'reports $listing as an unreadable listing and seeds nothing',
      async ({ value }) => {
        listWithHost(() => Promise.resolve(value))
        const store = useMissingModelDownloadStore()

        store.startTracking()

        await vi.waitFor(() =>
          expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
            surface: 'platform',
            errorType: 'error_listing_model_downloads'
          })
        )
        expect(store.stateFor(model).status).toBe('idle')
      }
    )

    it.for([
      { fault: 'no url', overrides: { url: undefined } },
      { fault: 'a numeric id', overrides: { id: 42 } },
      { fault: 'no directory', overrides: { directory: undefined } }
    ])(
      'skips a held entry with $fault for a file a cancelled download left known',
      async ({ overrides }) => {
        listWithHost(() =>
          Promise.resolve([
            { ...hostJob('paused'), ...overrides },
            hostJob('paused', {
              id: 'job-2',
              url: otherModel.url,
              filename: otherModel.name
            })
          ])
        )
        const store = useMissingModelDownloadStore()
        store.startTracking()

        emitHostProgress('cancelled', { id: 'job-0' })

        await vi.waitFor(() =>
          expect(store.stateFor(otherModel)).toMatchObject({ paused: true })
        )
        expect(store.stateFor(model).status).toBe('idle')
      }
    )

    it('lists the downloads through the bridge it belongs to', async () => {
      installDesktopHost()
      const bridge = {
        ...window.__comfyDesktop2,
        listModelDownloads() {
          return Promise.resolve(this === bridge ? [hostJob('paused')] : [])
        }
      }
      window.__comfyDesktop2 = bridge
      const store = useMissingModelDownloadStore()

      store.startTracking()

      await vi.waitFor(() =>
        expect(store.stateFor(model)).toMatchObject({ paused: true })
      )
    })

    it.for([
      {
        host: 'lists a null entry before the held job',
        listModelDownloads: () => Promise.resolve([null, hostJob('paused')])
      },
      {
        host: 'returns its listing synchronously',
        listModelDownloads: () => [hostJob('paused')]
      }
    ])(
      'shows the held job when the host $host',
      async ({ listModelDownloads }) => {
        listWithHost(listModelDownloads)
        const store = useMissingModelDownloadStore()

        store.startTracking()

        await vi.waitFor(() =>
          expect(store.stateFor(model)).toMatchObject({ paused: true })
        )
        expect(reportError).not.toHaveBeenCalled()
      }
    )

    it('reports a listing the host fails', async () => {
      const failure = new Error('cannot list')
      listJobs(Promise.reject(failure))

      useMissingModelDownloadStore().startTracking()

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(failure, {
          surface: 'platform',
          errorType: 'error_listing_model_downloads'
        })
      )
    })
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

  it("opens the loaded workflow's missing models when a re-check queued by a finished download starts during the load", async () => {
    installDesktopHost()
    const missingModelStore = useMissingModelStore()
    const candidate = fromPartial<MissingModelCandidate>({
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: model.name,
      directory: model.directory,
      isAssetSupported: true
    })
    const graph = fromPartial<LGraph>({ serialize: () => ({}) })
    const verifications: (() => void)[] = []
    vi.mocked(missingModelScan.scanAllModelCandidates).mockReturnValue([
      candidate
    ])
    vi.mocked(missingModelScan.enrichWithEmbeddedMetadata).mockImplementation(
      (candidates) => [...candidates]
    )
    vi.mocked(missingModelScan.hasPendingVerification).mockReturnValue(true)
    vi.mocked(
      missingModelScan.verifyAssetSupportedCandidates
    ).mockImplementation(
      (candidates) =>
        new Promise<void>((resolve) => {
          verifications.push(() => {
            for (const c of candidates) c.isMissing = true
            resolve()
          })
        })
    )
    vi.spyOn(api, 'getFolderPaths').mockResolvedValue({})
    const reloadNodeDefs: (() => void)[] = []
    const recheck = vi
      .spyOn(app, 'refreshMissingModels')
      .mockImplementation(() =>
        refreshMissingModelPipeline({
          graph,
          reloadNodeDefs: () =>
            new Promise<void>((resolve) => reloadNodeDefs.push(resolve)),
          missingModelStore,
          silent: true
        })
      )
    seedMissingModel()
    const store = useMissingModelDownloadStore()
    store.startTracking()

    const inFlightRecheck = missingModelStore.refreshMissingModels()
    reloadNodeDefs.shift()?.()
    await inFlightRecheck
    expect(verifications).toHaveLength(1)

    emitHostProgress('completed')
    await nextTick()
    expect(recheck).toHaveBeenCalledOnce()

    const onVerified = vi.fn()
    const load = await runMissingModelPipeline({
      graph,
      graphData: fromAny({}),
      missingModelStore,
      onVerified
    })
    await vi.runAllTimersAsync()
    for (const resolveReload of reloadNodeDefs.splice(0)) resolveReload()
    await vi.runAllTimersAsync()

    verifications[1]()
    await load.surfaced

    expect(onVerified).toHaveBeenCalledWith([candidate])
  })

  it("opens the loaded workflow's missing models when a re-check reloading node definitions resumes during the load", async () => {
    const missingModelStore = useMissingModelStore()
    const candidate = fromPartial<MissingModelCandidate>({
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: model.name,
      directory: model.directory,
      isAssetSupported: true
    })
    const graph = fromPartial<LGraph>({ serialize: () => ({}) })
    const verifications: (() => void)[] = []
    vi.mocked(missingModelScan.scanAllModelCandidates).mockReturnValue([
      candidate
    ])
    vi.mocked(missingModelScan.enrichWithEmbeddedMetadata).mockImplementation(
      (candidates) => [...candidates]
    )
    vi.mocked(missingModelScan.hasPendingVerification).mockReturnValue(true)
    vi.mocked(
      missingModelScan.verifyAssetSupportedCandidates
    ).mockImplementation(
      (candidates) =>
        new Promise<void>((resolve) => {
          verifications.push(() => {
            for (const c of candidates) c.isMissing = true
            resolve()
          })
        })
    )
    vi.spyOn(api, 'getFolderPaths').mockResolvedValue({})
    let finishReload = () => {}
    const recheck = refreshMissingModelPipeline({
      graph,
      reloadNodeDefs: () =>
        new Promise<void>((resolve) => {
          finishReload = resolve
        }),
      missingModelStore
    })

    const onVerified = vi.fn()
    const load = await runMissingModelPipeline({
      graph,
      graphData: fromAny({}),
      missingModelStore,
      onVerified
    })
    finishReload()
    await vi.runAllTimersAsync()

    verifications[0]()
    await load.surfaced

    expect(onVerified).toHaveBeenCalledWith([candidate])
    await vi.runAllTimersAsync()
    expect(verifications).toHaveLength(2)
    verifications[1]()
    await (
      await recheck
    ).surfaced
  })

  it('re-checks the graph a load switched to while the re-check waited on it', async () => {
    const missingModelStore = useMissingModelStore()
    const candidateFor = (name: string) =>
      fromPartial<MissingModelCandidate>({
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name,
        directory: model.directory,
        isMissing: true
      })
    const previousGraph = fromPartial<LGraph>({ serialize: () => ({}) })
    const loadedGraph = fromPartial<LGraph>({ serialize: () => ({}) })
    const loadedCandidate = candidateFor('loaded.safetensors')
    vi.mocked(missingModelScan.scanAllModelCandidates).mockImplementation(
      (graph) =>
        graph === loadedGraph
          ? [loadedCandidate]
          : [candidateFor('previous.safetensors')]
    )
    vi.mocked(missingModelScan.enrichWithEmbeddedMetadata).mockImplementation(
      (candidates) => [...candidates]
    )
    vi.spyOn(api, 'getFolderPaths').mockResolvedValue({})
    const rootGraph = vi
      .spyOn(app, 'rootGraph', 'get')
      .mockReturnValue(previousGraph)
    let finishLoad = () => {}
    const load = missingModelStore.whileWorkflowLoads(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve
        })
    )

    const recheck = app.refreshMissingModels({ reloadDefs: false })
    rootGraph.mockReturnValue(loadedGraph)
    finishLoad()
    await load

    const { confirmedCandidates } = await recheck
    expect(confirmedCandidates).toEqual([loadedCandidate])
  })
})
