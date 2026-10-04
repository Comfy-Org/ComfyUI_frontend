import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  ModelDownloadDispatchOutcome,
  ModelWithUrl
} from '@/platform/missingModel/missingModelDownload'
import { useTemplateModelRowDownloads } from '@/platform/workflow/templates/composables/useTemplateModelRowDownloads'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

type FolderPaths = Record<string, string[]>
type TemplateModelRowDownloadDependencies = Parameters<
  typeof useTemplateModelRowDownloads
>[0]
type DispatchDownload = NonNullable<
  TemplateModelRowDownloadDependencies['dispatchDownload']
>

function model(
  name: string,
  url = `https://huggingface.co/org/model/resolve/main/${name}`
): ModelWithUrl {
  return { name, url, directory: 'checkpoints' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function pendingHostRequest(
  host: 'desktop2' | 'electron' = 'desktop2'
): ModelDownloadDispatchOutcome {
  return {
    status: 'host-requested',
    host,
    hostResult: new Promise<boolean>(() => undefined)
  }
}

function createDownloadHarness({
  folderPaths = {},
  dispatchDownload = () => pendingHostRequest()
}: {
  folderPaths?: FolderPaths
  dispatchDownload?: DispatchDownload
} = {}) {
  let desktopProgress!: (progress: ComfyDownloadProgress) => void
  let legacyProgress!: (download: ElectronDownload) => void
  const stopDesktop = vi.fn()
  const stopLegacy = vi.fn()
  const downloads = useTemplateModelRowDownloads({
    folderPaths,
    dispatchDownload,
    subscribeDesktopProgress: (listener) => {
      desktopProgress = listener
      return stopDesktop
    },
    subscribeLegacyProgress: (listener) => {
      legacyProgress = listener
      return stopLegacy
    }
  })

  return {
    downloads,
    emitDesktop: (progress: ComfyDownloadProgress) => desktopProgress(progress),
    emitLegacy: (download: ElectronDownload) => legacyProgress(download),
    stopDesktop,
    stopLegacy
  }
}

describe('useTemplateModelRowDownloads', () => {
  it('reactively updates a row whose idle state was observed before download', () => {
    const request = model('reactive.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()
    const renderedState = computed(() => downloads.stateFor(request))

    expect(renderedState.value).toEqual({ status: 'idle', attempt: 0 })

    downloads.request(request)

    expect(renderedState.value).toEqual({ status: 'starting', attempt: 1 })

    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0.25,
      receivedBytes: 256,
      totalBytes: 1024,
      status: 'downloading'
    })
    expect(renderedState.value).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'active',
      receivedBytes: 256,
      totalBytes: 1024,
      fraction: 0.25
    })
  })

  it('subscribes only to Desktop2 before direct host dispatch', async () => {
    const order: string[] = []
    const request = model('desktop2.safetensors')
    const dispatchDownload = vi.fn((): ModelDownloadDispatchOutcome => {
      order.push('dispatch')
      return {
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      }
    })

    const downloads = useTemplateModelRowDownloads({
      folderPaths: {},
      dispatchDownload,
      subscribeDesktopProgress: () => {
        order.push('desktop-subscribe')
        return () => undefined
      },
      subscribeLegacyProgress: () => {
        order.push('legacy-subscribe')
        return () => undefined
      }
    })
    downloads.request(request)

    expect(order).toEqual(['desktop-subscribe', 'dispatch'])
    expect(dispatchDownload).toHaveBeenCalledWith(
      request,
      {},
      {
        revealLegacyDownload: false
      }
    )
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('dispatches a legacy row with its resolved paths without revealing the sidebar', async () => {
    const hostResult = deferred<boolean>()
    const folderPaths = { checkpoints: ['/models/checkpoints'] }
    const dispatchDownload = vi.fn<DispatchDownload>().mockReturnValue({
      status: 'host-requested',
      host: 'electron',
      hostResult: hostResult.promise
    })
    const request = model('legacy.safetensors')
    const { downloads } = createDownloadHarness({
      folderPaths,
      dispatchDownload
    })

    downloads.request(request)

    expect(dispatchDownload).toHaveBeenCalledOnce()
    expect(dispatchDownload).toHaveBeenCalledWith(request, folderPaths, {
      revealLegacyDownload: false
    })
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })

    hostResult.resolve(true)
    await hostResult.promise
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('fails a refused host request and keeps an accepted one starting', async () => {
    const falseResult = deferred<boolean>()
    const trueResult = deferred<boolean>()
    const rejectedResult = deferred<boolean>()
    const requests = {
      false: model('false.safetensors'),
      true: model('true.safetensors'),
      rejected: model('rejected.safetensors')
    }
    const dispatchDownload = vi.fn(
      (request: ModelWithUrl): ModelDownloadDispatchOutcome => ({
        status: 'host-requested',
        host: 'desktop2',
        hostResult:
          request === requests.false
            ? falseResult.promise
            : request === requests.true
              ? trueResult.promise
              : rejectedResult.promise
      })
    )
    const { downloads } = createDownloadHarness({
      dispatchDownload
    })

    downloads.request(requests.false)
    downloads.request(requests.true)
    downloads.request(requests.rejected)
    falseResult.resolve(false)
    trueResult.resolve(true)
    rejectedResult.reject(new Error('Host rejected request'))

    await vi.waitFor(() =>
      expect(downloads.stateFor(requests.rejected)).toEqual({
        status: 'failed',
        attempt: 1,
        reason: 'error'
      })
    )
    expect(downloads.stateFor(requests.false)).toEqual({
      status: 'failed',
      attempt: 1,
      reason: 'error'
    })
    expect(downloads.stateFor(requests.true)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('maps Desktop2 native events and prefers byte counters for fractions', async () => {
    const { downloads, emitDesktop } = createDownloadHarness()
    const active = model('active.safetensors')
    downloads.request(active)

    emitDesktop({
      url: active.url,
      filename: active.name,
      directory: active.directory,
      progress: 99,
      receivedBytes: 256,
      totalBytes: 1024,
      status: 'downloading'
    })
    expect(downloads.stateFor(active)).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'active',
      receivedBytes: 256,
      totalBytes: 1024,
      fraction: 0.25
    })

    emitDesktop({
      url: active.url,
      filename: active.name,
      progress: 0.75,
      status: 'paused'
    })
    // Without byte counters the host's own figure is the only one there is.
    expect(downloads.stateFor(active)).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'paused',
      receivedBytes: null,
      totalBytes: null,
      fraction: 0.75
    })

    emitDesktop({
      url: active.url,
      filename: active.name,
      progress: 1,
      status: 'completed'
    })
    expect(downloads.stateFor(active)).toEqual({ status: 'done', attempt: 1 })
  })

  it.for([
    { name: 'out of range', progress: 42 },
    { name: 'negative', progress: -1 },
    { name: 'not finite', progress: Number.NaN }
  ])('reports no fraction when the host figure is $name', ({ progress }) => {
    const active = model('scale.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(active)

    emitDesktop({
      url: active.url,
      filename: active.name,
      progress,
      status: 'downloading'
    })

    expect(downloads.stateFor(active)).toMatchObject({ fraction: null })
  })

  it('prefers byte counters over the host figure', () => {
    const active = model('bytes-win.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(active)

    emitDesktop({
      url: active.url,
      filename: active.name,
      progress: 0.9,
      receivedBytes: 256,
      totalBytes: 1024,
      status: 'downloading'
    })

    expect(downloads.stateFor(active)).toMatchObject({ fraction: 0.25 })
  })

  it('correlates Desktop2 progress by URL, filename, and available directory', async () => {
    const sharedUrl =
      'https://huggingface.co/org/model/resolve/main/shared.safetensors'
    const checkpoint = model('checkpoint.safetensors', sharedUrl)
    const lora = {
      ...model('lora.safetensors', sharedUrl),
      directory: 'loras'
    }
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(checkpoint)
    downloads.request(lora)

    emitDesktop({
      url: sharedUrl,
      filename: checkpoint.name,
      directory: checkpoint.directory,
      progress: 1,
      status: 'completed'
    })

    expect(downloads.stateFor(checkpoint)).toEqual({
      status: 'done',
      attempt: 1
    })
    expect(downloads.stateFor(lora)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('does not fan out directory-less progress across ambiguous model rows', async () => {
    const sharedUrl =
      'https://huggingface.co/org/model/resolve/main/shared.safetensors'
    const checkpoint = model('shared.safetensors', sharedUrl)
    const lora = { ...checkpoint, directory: 'loras' }
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(checkpoint)
    downloads.request(lora)

    emitDesktop({
      url: sharedUrl,
      filename: checkpoint.name,
      progress: 1,
      status: 'completed'
    })

    expect(downloads.stateFor(checkpoint)).toEqual({
      status: 'starting',
      attempt: 1
    })
    expect(downloads.stateFor(lora)).toEqual({
      status: 'starting',
      attempt: 1
    })

    emitDesktop({
      url: sharedUrl,
      filename: lora.name,
      directory: lora.directory,
      progress: 1,
      status: 'completed'
    })
    emitDesktop({
      url: sharedUrl,
      filename: checkpoint.name,
      progress: 1,
      status: 'completed'
    })

    expect(downloads.stateFor(checkpoint)).toEqual({
      status: 'done',
      attempt: 1
    })
    expect(downloads.stateFor(lora)).toEqual({
      status: 'done',
      attempt: 1
    })
  })

  it('maps and correlates legacy progress by URL and filename', async () => {
    const sharedUrl = 'https://example.com/shared-download'
    const first = model('first.safetensors', sharedUrl)
    const second = model('second.safetensors', sharedUrl)
    const { downloads, emitLegacy } = createDownloadHarness({
      dispatchDownload: () => pendingHostRequest('electron')
    })
    downloads.request(first)
    downloads.request(second)

    emitLegacy({
      url: sharedUrl,
      filename: first.name,
      status: DownloadStatus.IN_PROGRESS,
      progress: 0.4,
      receivedBytes: 400,
      totalBytes: 1000
    })
    expect(downloads.stateFor(first)).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'active',
      receivedBytes: 400,
      totalBytes: 1000,
      fraction: 0.4
    })
    expect(downloads.stateFor(second)).toEqual({
      status: 'starting',
      attempt: 1
    })

    emitLegacy({
      url: sharedUrl,
      filename: first.name,
      status: DownloadStatus.COMPLETED,
      progress: 1
    })
    expect(downloads.stateFor(first)).toEqual({
      status: 'done',
      attempt: 1
    })
  })

  it('resets a changed model URL only when a new download is requested', () => {
    const initial = model(
      'replaceable.safetensors',
      'https://example.com/initial-download'
    )
    const replacement = {
      ...initial,
      url: 'https://example.com/replacement-download'
    }
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(initial)
    emitDesktop({
      url: initial.url,
      filename: initial.name,
      directory: initial.directory,
      progress: 1,
      status: 'completed'
    })

    expect(downloads.stateFor(replacement)).toEqual({
      status: 'idle',
      attempt: 0
    })
    expect(downloads.stateFor(initial)).toEqual({
      status: 'done',
      attempt: 1
    })

    downloads.request(replacement)

    expect(downloads.stateFor(replacement)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('fails a row the host cannot place instead of deferring it', () => {
    const dispatchDownload = vi.fn<DispatchDownload>().mockReturnValue({
      status: 'not-dispatched',
      reason: 'missing-directory-path'
    })
    const request = model('unplaceable.safetensors')
    const { downloads } = createDownloadHarness({ dispatchDownload })

    downloads.request(request)

    expect(dispatchDownload).toHaveBeenCalledOnce()
    expect(downloads.stateFor(request)).toEqual({
      status: 'failed',
      reason: 'error',
      attempt: 1
    })
  })

  it('ignores an old URL whose host result settles after a replacement', async () => {
    const firstResult = deferred<boolean>()
    const initial = model('swapped.safetensors', 'https://example.com/first')
    const replacement = { ...initial, url: 'https://example.com/second' }
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: firstResult.promise
      })
      .mockReturnValue(pendingHostRequest())
    const { downloads } = createDownloadHarness({ dispatchDownload })

    downloads.request(initial)
    downloads.request(replacement)
    firstResult.reject(new Error('late'))
    await vi.waitFor(() => expect(dispatchDownload).toHaveBeenCalledTimes(2))

    // Reporting the old failure would resurrect the old row through
    // `initializeState`, leaving the replacement idle.
    expect(downloads.stateFor(replacement)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('lets a replacement URL report through its own job', () => {
    const initial = model('swapped.safetensors', 'https://example.com/first')
    const replacement = { ...initial, url: 'https://example.com/second' }
    const { downloads, emitDesktop } = createDownloadHarness()
    const tick = (m: typeof initial, id: string) => ({
      id,
      url: m.url,
      filename: m.name,
      directory: m.directory,
      progress: 0.5,
      receivedBytes: 1,
      totalBytes: 2,
      status: 'downloading' as const
    })

    downloads.request(initial)
    emitDesktop(tick(initial, 'job-first'))

    // The row is keyed by filename, so the replacement reuses the identity.
    downloads.request(replacement)
    emitDesktop(tick(replacement, 'job-second'))

    expect(downloads.stateFor(replacement)).toMatchObject({
      status: 'downloading',
      attempt: 1
    })
  })

  it('ignores an abandoned job stream after a retry', async () => {
    const request = model('retried.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()
    const tick = (
      id: string,
      status: 'downloading' | 'cancelled' | 'completed'
    ) => ({
      id,
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0.5,
      receivedBytes: 1,
      totalBytes: 2,
      status
    })

    downloads.request(request)
    emitDesktop(tick('job-1', 'downloading'))
    emitDesktop(tick('job-1', 'cancelled'))
    expect(downloads.stateFor(request)).toEqual({
      status: 'failed',
      attempt: 1,
      reason: 'cancelled'
    })

    downloads.request(request)
    emitDesktop(tick('job-2', 'downloading'))

    // Stamped with attempt 2 because the stamp is read from the row, so only
    // the job id can reject it.
    emitDesktop(tick('job-1', 'cancelled'))
    expect(downloads.stateFor(request)).toMatchObject({
      status: 'downloading',
      attempt: 2
    })

    emitDesktop(tick('job-2', 'completed'))
    expect(downloads.stateFor(request)).toEqual({
      status: 'done',
      attempt: 2
    })
  })

  it('refuses a terminal event from a job that never reported activity', () => {
    const request = model('unannounced.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()

    downloads.request(request)
    emitDesktop({
      id: 'job-stale',
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'cancelled'
    })

    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('requires retry activity before accepting an uncorrelated native terminal', async () => {
    const request = model('retry-terminal.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness()
    downloads.request(request)
    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'error'
    })
    downloads.request(request)

    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 1,
      status: 'completed'
    })
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 2
    })

    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'pending'
    })
    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 1,
      status: 'completed'
    })

    expect(downloads.stateFor(request)).toEqual({
      status: 'done',
      attempt: 2
    })
  })

  it('unsubscribes both observers once however often it is disposed', () => {
    const { downloads, stopDesktop, stopLegacy } = createDownloadHarness({
      dispatchDownload: () => pendingHostRequest('electron')
    })
    // The legacy observer only exists once a legacy dispatch subscribes it.
    downloads.request(model('dispose.safetensors'))

    // A successful open runs both onClose() and onBeforeUnmount().
    downloads.dispose()
    downloads.dispose()

    expect(stopDesktop).toHaveBeenCalledOnce()
    expect(stopLegacy).toHaveBeenCalledOnce()
  })
})
