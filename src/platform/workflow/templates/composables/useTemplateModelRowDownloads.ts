import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { shallowReactive } from 'vue'

import { dispatchModelDownload } from '@/platform/missingModel/missingModelDownload'
import type {
  ModelDownloadDispatchOutcome,
  ModelWithUrl
} from '@/platform/missingModel/missingModelDownload'
import {
  createTemplateModelDownloadState,
  getTemplateModelDownloadIdentity,
  reduceTemplateModelDownloadState
} from '@/platform/workflow/templates/utils/templateModelDownloadState'
import type {
  TemplateModelDownloadEvent,
  TemplateModelDownloadState
} from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

type FolderPaths = Record<string, string[]>

type SubscribeDesktopProgress = (
  listener: (progress: ComfyDownloadProgress) => void
) => () => void

type SubscribeLegacyProgress = (
  listener: (download: ElectronDownload) => void
) => () => void

export type TemplateModelRowDownloadDependencies = {
  loadFolderPaths: () => Promise<FolderPaths>
  dispatchDownload?: (
    model: ModelWithUrl,
    paths: FolderPaths,
    options: { revealLegacyDownload: false }
  ) => ModelDownloadDispatchOutcome
  subscribeDesktopProgress?: SubscribeDesktopProgress
  subscribeLegacyProgress?: SubscribeLegacyProgress
}

function subscribeToDesktopProgress(
  listener: (progress: ComfyDownloadProgress) => void
): () => void {
  return window.__comfyDesktop2?.onDownloadProgress?.(listener) ?? (() => {})
}

function subscribeToLegacyProgress(
  listener: (download: ElectronDownload) => void
): () => void {
  return useElectronDownloadStore().subscribeToDownloadProgress(listener)
}

function validByteCount(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function desktopProgressEvent(
  progress: ComfyDownloadProgress,
  attempt: number
): TemplateModelDownloadEvent {
  switch (progress.status) {
    case 'pending':
      return { type: 'started', attempt }
    case 'downloading':
    case 'paused': {
      const receivedBytes = validByteCount(progress.receivedBytes)
      const totalBytes = validByteCount(progress.totalBytes)
      const fraction =
        receivedBytes !== null &&
        totalBytes !== null &&
        totalBytes > 0 &&
        receivedBytes <= totalBytes
          ? receivedBytes / totalBytes
          : null
      return {
        type: 'progress',
        attempt,
        activity: progress.status === 'paused' ? 'paused' : 'active',
        receivedBytes,
        totalBytes,
        fraction
      }
    }
    case 'completed':
      return { type: 'completed', attempt }
    case 'error':
    case 'cancelled':
      return { type: progress.status, attempt }
    default:
      return progress.status satisfies never
  }
}

function validLegacyFraction(value: number | undefined): number | null {
  return value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null
}

function legacyProgressEvent(
  download: ElectronDownload,
  attempt: number
): TemplateModelDownloadEvent | null {
  switch (download.status) {
    case DownloadStatus.PENDING:
      return { type: 'started', attempt }
    case DownloadStatus.IN_PROGRESS:
    case DownloadStatus.PAUSED:
      return {
        type: 'progress',
        attempt,
        activity:
          download.status === DownloadStatus.PAUSED ? 'paused' : 'active',
        receivedBytes: validByteCount(download.receivedBytes),
        totalBytes: validByteCount(download.totalBytes),
        fraction: validLegacyFraction(download.progress)
      }
    case DownloadStatus.COMPLETED:
      return { type: 'completed', attempt }
    case DownloadStatus.ERROR:
      return { type: 'error', attempt }
    case DownloadStatus.CANCELLED:
      return { type: 'cancelled', attempt }
    case undefined:
      return null
    default:
      return download.status satisfies never
  }
}

export function useTemplateModelRowDownloads({
  loadFolderPaths,
  dispatchDownload = dispatchModelDownload,
  subscribeDesktopProgress = subscribeToDesktopProgress,
  subscribeLegacyProgress = subscribeToLegacyProgress
}: TemplateModelRowDownloadDependencies) {
  const states = shallowReactive(new Map<string, TemplateModelDownloadState>())
  const models = new Map<string, ModelWithUrl>()
  const nativeActivityAttempts = new Map<string, number>()

  function identityFor(model: ModelWithUrl): string {
    return getTemplateModelDownloadIdentity(model)
  }

  function stateFor(model: ModelWithUrl): TemplateModelDownloadState {
    const identity = identityFor(model)
    const previousModel = models.get(identity)
    if (previousModel && previousModel.url !== model.url) {
      const initial = createTemplateModelDownloadState()
      models.set(identity, model)
      states.set(identity, initial)
      nativeActivityAttempts.delete(identity)
      return initial
    }

    models.set(identity, model)
    const current = states.get(identity)
    if (current) return current

    const initial = createTemplateModelDownloadState()
    states.set(identity, initial)
    return initial
  }

  function applyEvent(
    model: ModelWithUrl,
    event: TemplateModelDownloadEvent
  ): void {
    const identity = identityFor(model)
    let current = stateFor(model)
    if (
      current.status === 'queued' &&
      event.type !== 'started' &&
      event.type !== 'error' &&
      event.type !== 'cancelled'
    ) {
      current = reduceTemplateModelDownloadState(current, {
        type: 'started',
        attempt: current.attempt
      })
    }
    states.set(identity, reduceTemplateModelDownloadState(current, event))
  }

  function applyNativeEvent(
    model: ModelWithUrl,
    event: TemplateModelDownloadEvent
  ): void {
    const identity = identityFor(model)
    if (event.type === 'started' || event.type === 'progress') {
      nativeActivityAttempts.set(identity, event.attempt)
    } else if (
      (event.type === 'completed' ||
        event.type === 'error' ||
        event.type === 'cancelled') &&
      event.attempt > 1 &&
      nativeActivityAttempts.get(identity) !== event.attempt
    ) {
      return
    }

    applyEvent(model, event)
  }

  function forMatchingModels(
    progress: { url: string; filename: string; directory?: string },
    apply: (model: ModelWithUrl, attempt: number) => void
  ): void {
    for (const [identity, model] of models) {
      if (
        model.url !== progress.url ||
        model.name !== progress.filename ||
        (progress.directory !== undefined &&
          model.directory !== progress.directory)
      ) {
        continue
      }
      const state = states.get(identity)
      if (!state || state.status === 'idle') continue
      apply(model, state.attempt)
    }
  }

  const stopDesktopProgress = subscribeDesktopProgress((progress) => {
    forMatchingModels(progress, (model, attempt) => {
      applyNativeEvent(model, desktopProgressEvent(progress, attempt))
    })
  })
  const stopLegacyProgress = subscribeLegacyProgress((download) => {
    forMatchingModels(download, (model, attempt) => {
      const event = legacyProgressEvent(download, attempt)
      if (event) applyNativeEvent(model, event)
    })
  })

  function isCurrentQueuedAttempt(
    model: ModelWithUrl,
    attempt: number
  ): boolean {
    const identity = identityFor(model)
    const currentModel = models.get(identity)
    const currentState = states.get(identity)
    return (
      currentModel?.url === model.url &&
      currentState?.status === 'queued' &&
      currentState.attempt === attempt
    )
  }

  function fail(model: ModelWithUrl, attempt: number): void {
    applyEvent(model, { type: 'error', attempt })
  }

  function handleOutcome(
    model: ModelWithUrl,
    attempt: number,
    outcome: ModelDownloadDispatchOutcome,
    canLoadFolderPaths: boolean
  ): void {
    switch (outcome.status) {
      case 'host-requested':
        applyEvent(model, { type: 'started', attempt })
        void outcome.hostResult.catch(() => fail(model, attempt))
        return
      case 'browser-requested':
      case 'dispatch-failed':
        fail(model, attempt)
        return
      case 'not-dispatched':
        if (
          outcome.reason !== 'missing-directory-path' ||
          !canLoadFolderPaths
        ) {
          fail(model, attempt)
          return
        }
        void loadFolderPaths().then(
          (paths) => {
            if (isCurrentQueuedAttempt(model, attempt)) {
              dispatch(model, attempt, paths, false)
            }
          },
          () => {
            if (isCurrentQueuedAttempt(model, attempt)) fail(model, attempt)
          }
        )
        return
      default:
        return outcome satisfies never
    }
  }

  function dispatch(
    model: ModelWithUrl,
    attempt: number,
    paths: FolderPaths,
    canLoadFolderPaths: boolean
  ): void {
    try {
      handleOutcome(
        model,
        attempt,
        dispatchDownload(model, paths, { revealLegacyDownload: false }),
        canLoadFolderPaths
      )
    } catch {
      fail(model, attempt)
    }
  }

  function request(model: ModelWithUrl): void {
    const identity = identityFor(model)
    const current = stateFor(model)
    const queued = reduceTemplateModelDownloadState(current, {
      type: 'request'
    })
    if (queued === current) return

    states.set(identity, queued)
    dispatch(model, queued.attempt, {}, true)
  }

  let disposed = false
  function dispose(): void {
    if (disposed) return
    disposed = true
    stopDesktopProgress()
    stopLegacyProgress()
  }

  return { stateFor, request, dispose }
}
