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

function noProgressSubscription() {
  return () => undefined
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
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: () => paths.promise,
      dispatchDownload,
      subscribeDesktopProgress: noProgressSubscription,
      subscribeLegacyProgress: noProgressSubscription
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
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload,
      subscribeDesktopProgress: noProgressSubscription,
      subscribeLegacyProgress: noProgressSubscription
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
    let onDesktopProgress!: (progress: ComfyDownloadProgress) => void
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload: () => ({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      }),
      subscribeDesktopProgress: (listener) => {
        onDesktopProgress = listener
        return () => undefined
      },
      subscribeLegacyProgress: noProgressSubscription
    })
    const active = model('active.safetensors')
    downloads.request(active)

    onDesktopProgress({
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

    onDesktopProgress({
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

    onDesktopProgress({
      url: active.url,
      filename: active.name,
      progress: 1,
      status: 'completed'
    })
    expect(downloads.stateFor(active)).toEqual({ status: 'done', attempt: 1 })
  })

  it('correlates Desktop2 progress by URL, filename, and available directory', async () => {
    let onDesktopProgress!: (progress: ComfyDownloadProgress) => void
    const sharedUrl =
      'https://huggingface.co/org/model/resolve/main/shared.safetensors'
    const checkpoint = model('checkpoint.safetensors', sharedUrl)
    const lora = {
      ...model('lora.safetensors', sharedUrl),
      directory: 'loras'
    }
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload: () => ({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      }),
      subscribeDesktopProgress: (listener) => {
        onDesktopProgress = listener
        return () => undefined
      },
      subscribeLegacyProgress: noProgressSubscription
    })
    downloads.request(checkpoint)
    downloads.request(lora)

    onDesktopProgress({
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
    let onDesktopProgress!: (progress: ComfyDownloadProgress) => void
    const sharedUrl =
      'https://huggingface.co/org/model/resolve/main/shared.safetensors'
    const checkpoint = model('shared.safetensors', sharedUrl)
    const lora = { ...checkpoint, directory: 'loras' }
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload: () => ({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      }),
      subscribeDesktopProgress: (listener) => {
        onDesktopProgress = listener
        return () => undefined
      },
      subscribeLegacyProgress: noProgressSubscription
    })
    downloads.request(checkpoint)
    downloads.request(lora)

    onDesktopProgress({
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

    onDesktopProgress({
      url: sharedUrl,
      filename: lora.name,
      directory: lora.directory,
      progress: 1,
      status: 'completed'
    })
    onDesktopProgress({
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
    let onLegacyProgress!: (download: ElectronDownload) => void
    const sharedUrl = 'https://example.com/shared-download'
    const first = model('first.safetensors', sharedUrl)
    const second = model('second.safetensors', sharedUrl)
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload: () => ({
        status: 'host-requested',
        host: 'electron',
        hostResult: new Promise<boolean>(() => undefined)
      }),
      subscribeDesktopProgress: noProgressSubscription,
      subscribeLegacyProgress: (listener) => {
        onLegacyProgress = listener
        return () => undefined
      }
    })
    downloads.request(first)
    downloads.request(second)

    onLegacyProgress({
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

    onLegacyProgress({
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

  it('does not retry dispatch from an obsolete detached folder lookup', async () => {
    const paths = deferred<FolderPaths>()
    let onDesktopProgress!: (progress: ComfyDownloadProgress) => void
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'not-dispatched',
        reason: 'missing-directory-path'
      })
      .mockReturnValue({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      })
    const request = model('obsolete-paths.safetensors')
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: () => paths.promise,
      dispatchDownload,
      subscribeDesktopProgress: (listener) => {
        onDesktopProgress = listener
        return () => undefined
      },
      subscribeLegacyProgress: noProgressSubscription
    })
    downloads.request(request)
    onDesktopProgress({
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
    let onDesktopProgress!: (progress: ComfyDownloadProgress) => void
    const request = model('retry-terminal.safetensors')
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: vi.fn(),
      dispatchDownload: () => ({
        status: 'host-requested',
        host: 'desktop2',
        hostResult: new Promise<boolean>(() => undefined)
      }),
      subscribeDesktopProgress: (listener) => {
        onDesktopProgress = listener
        return () => undefined
      },
      subscribeLegacyProgress: noProgressSubscription
    })
    downloads.request(request)
    onDesktopProgress({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'error'
    })
    downloads.request(request)

    onDesktopProgress({
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

    onDesktopProgress({
      url: request.url,
      filename: request.name,
      directory: request.directory,
      progress: 0,
      status: 'pending'
    })
    onDesktopProgress({
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
    const stopDesktop = vi.fn()
    const stopLegacy = vi.fn()
    const paths = deferred<FolderPaths>()
    const dispatchDownload = vi
      .fn<DispatchDownload>()
      .mockReturnValueOnce({
        status: 'not-dispatched',
        reason: 'missing-directory-path'
      })
      .mockReturnValueOnce({
        status: 'host-requested',
        host: 'electron',
        hostResult: new Promise<boolean>(() => undefined)
      })
    const downloads = useTemplateModelRowDownloads({
      loadFolderPaths: () => paths.promise,
      dispatchDownload,
      subscribeDesktopProgress: () => stopDesktop,
      subscribeLegacyProgress: () => stopLegacy
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
