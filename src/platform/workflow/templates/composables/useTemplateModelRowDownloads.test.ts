import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
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
  loadFolderPaths = vi.fn(async () => ({})),
  dispatchDownload = () => pendingHostRequest()
}: {
  loadFolderPaths?: () => Promise<FolderPaths>
  dispatchDownload?: DispatchDownload
} = {}) {
  let desktopProgress!: (progress: ComfyDownloadProgress) => void
  let legacyProgress!: (download: ElectronDownload) => void
  const stopDesktop = vi.fn()
  const stopLegacy = vi.fn()
  const downloads = useTemplateModelRowDownloads({
    loadFolderPaths,
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
  it('subscribes before direct host dispatch without loading folder paths', async () => {
    const order: string[] = []
    const loadFolderPaths = vi.fn<() => Promise<FolderPaths>>()
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
      loadFolderPaths,
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

    expect(order).toEqual(['desktop-subscribe', 'legacy-subscribe', 'dispatch'])
    expect(dispatchDownload).toHaveBeenCalledWith(
      request,
      {},
      {
        revealLegacyDownload: false
      }
    )
    expect(loadFolderPaths).not.toHaveBeenCalled()
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('queues a legacy row while paths load detached and retries without revealing the sidebar', async () => {
    const paths = deferred<FolderPaths>()
    const hostResult = deferred<boolean>()
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'not-dispatched',
        reason: 'missing-directory-path'
      })
      .mockReturnValueOnce({
        status: 'host-requested',
        host: 'electron',
        hostResult: hostResult.promise
      })
    const request = model('legacy.safetensors')
    const { downloads } = createDownloadHarness({
      loadFolderPaths: () => paths.promise,
      dispatchDownload
    })

    downloads.request(request)

    expect(downloads.stateFor(request)).toEqual({
      status: 'queued',
      attempt: 1
    })
    expect(dispatchDownload).toHaveBeenCalledOnce()

    const folderPaths = { checkpoints: ['/models/checkpoints'] }
    paths.resolve(folderPaths)
    await vi.waitFor(() => expect(dispatchDownload).toHaveBeenCalledTimes(2))

    expect(dispatchDownload).toHaveBeenLastCalledWith(request, folderPaths, {
      revealLegacyDownload: false
    })
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })

    hostResult.resolve(false)
    await hostResult.promise
    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('keeps resolved host booleans uninterpreted and makes rejection retryable', async () => {
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
      loadFolderPaths: vi.fn(),
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
      status: 'starting',
      attempt: 1
    })
    expect(downloads.stateFor(requests.true)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })

  it('maps Desktop2 native events and derives fractions only from valid bytes', async () => {
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
    expect(downloads.stateFor(active)).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'paused',
      receivedBytes: null,
      totalBytes: null,
      fraction: null
    })

    emitDesktop({
      url: active.url,
      filename: active.name,
      progress: 1,
      status: 'completed'
    })
    expect(downloads.stateFor(active)).toEqual({ status: 'done', attempt: 1 })
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

  it('does not retry dispatch from an obsolete detached folder lookup', async () => {
    const paths = deferred<FolderPaths>()
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'not-dispatched',
        reason: 'missing-directory-path'
      })
      .mockReturnValue(pendingHostRequest())
    const request = model('obsolete-paths.safetensors')
    const { downloads, emitDesktop } = createDownloadHarness({
      loadFolderPaths: () => paths.promise,
      dispatchDownload
    })
    downloads.request(request)
    emitDesktop({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'error'
    })
    downloads.request(request)

    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 2
    })
    expect(dispatchDownload).toHaveBeenCalledTimes(2)

    paths.resolve({ checkpoints: ['/models/checkpoints'] })
    await paths.promise
    await Promise.resolve()

    expect(dispatchDownload).toHaveBeenCalledTimes(2)
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

  it('disposes both observers without changing active download state', async () => {
    const paths = deferred<FolderPaths>()
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'not-dispatched',
        reason: 'missing-directory-path'
      })
      .mockReturnValueOnce(pendingHostRequest('electron'))
    const { downloads, stopDesktop, stopLegacy } = createDownloadHarness({
      loadFolderPaths: () => paths.promise,
      dispatchDownload
    })
    const request = model('dispose.safetensors')
    downloads.request(request)

    downloads.dispose()

    expect(stopDesktop).toHaveBeenCalledOnce()
    expect(stopLegacy).toHaveBeenCalledOnce()
    expect(downloads.stateFor(request)).toEqual({
      status: 'queued',
      attempt: 1
    })

    paths.resolve({ checkpoints: ['/models/checkpoints'] })
    await vi.waitFor(() => expect(dispatchDownload).toHaveBeenCalledTimes(2))

    expect(downloads.stateFor(request)).toEqual({
      status: 'starting',
      attempt: 1
    })
  })
})
