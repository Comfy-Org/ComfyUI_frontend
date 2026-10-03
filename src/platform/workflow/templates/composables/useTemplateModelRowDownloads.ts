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
  TemplateModelDownloadHostEvent,
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

type TemplateModelRowDownloadDependencies = {
  /**
   * Resolved before the owner mounts, so a dispatch never waits on a lookup
   * that could finish after the owner is gone. Empty for hosts that resolve
   * their own directories.
   */
  folderPaths: FolderPaths
  dispatchDownload?: (
    model: ModelWithUrl,
    paths: FolderPaths,
    options: { revealLegacyDownload: false }
  ) => ModelDownloadDispatchOutcome
  subscribeDesktopProgress?: SubscribeDesktopProgress
  subscribeLegacyProgress?: SubscribeLegacyProgress
}

function modelMatchesProgress(
  model: ModelWithUrl,
  progress: { url: string; filename: string; directory?: string }
): boolean {
  return (
    model.url === progress.url &&
    model.name === progress.filename &&
    (progress.directory === undefined || model.directory === progress.directory)
  )
}

function activeAttempt(
  state: TemplateModelDownloadState | undefined
): number | undefined {
  if (!state) return undefined
  if (!['queued', 'starting', 'downloading'].includes(state.status)) return
  return state.attempt
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

/**
 * `ComfyDownloadProgress.progress` has no documented scale, but the template
 * input store reads the same field as a 0..1 fraction and renders it as a
 * percentage, so that is the reading used here. Only in range, and only as a
 * fallback: byte counters are exact where they exist.
 */
function reportedFraction(progress: number): number | null {
  return Number.isFinite(progress) && progress >= 0 && progress <= 1
    ? progress
    : null
}

function downloadFraction(
  receivedBytes: number | null,
  totalBytes: number | null
): number | null {
  if (receivedBytes === null || totalBytes === null) return null
  if (totalBytes <= 0 || receivedBytes > totalBytes) return null
  return receivedBytes / totalBytes
}

function terminalDesktopEvent(
  status: 'completed' | 'error' | 'cancelled',
  attempt: number
): TemplateModelDownloadHostEvent {
  return {
    type: status === 'completed' ? 'completed' : status,
    attempt
  }
}

function desktopProgressEvent(
  progress: ComfyDownloadProgress,
  attempt: number
): TemplateModelDownloadHostEvent {
  switch (progress.status) {
    case 'pending':
      return { type: 'started', attempt }
    case 'downloading':
    case 'paused': {
      const receivedBytes = validByteCount(progress.receivedBytes)
      const totalBytes = validByteCount(progress.totalBytes)
      return {
        type: 'progress',
        attempt,
        activity: progress.status === 'paused' ? 'paused' : 'active',
        receivedBytes,
        totalBytes,
        fraction:
          downloadFraction(receivedBytes, totalBytes) ??
          reportedFraction(progress.progress)
      }
    }
    case 'completed':
    case 'error':
    case 'cancelled':
      return terminalDesktopEvent(progress.status, attempt)
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
): TemplateModelDownloadHostEvent | null {
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
  folderPaths,
  dispatchDownload = dispatchModelDownload,
  subscribeDesktopProgress = subscribeToDesktopProgress,
  subscribeLegacyProgress = subscribeToLegacyProgress
}: TemplateModelRowDownloadDependencies) {
  let disposed = false
  const states = shallowReactive(new Map<string, TemplateModelDownloadState>())
  const models = new Map<string, ModelWithUrl>()
  const nativeActivityAttempts = new Map<string, number>()
  /**
   * The desktop job id observed carrying this row's current attempt. Native
   * payloads are stamped with whatever the row says now, so the stamp cannot
   * tell a live stream from an abandoned one; the job id can. Bound by
   * non-terminal activity only, so an abandoned stream's terminal event
   * cannot claim a fresh attempt.
   */
  const nativeJobs = new Map<string, { attempt: number; jobId: string }>()

  function identityFor(model: ModelWithUrl): string {
    return getTemplateModelDownloadIdentity(model)
  }

  function initializeState(model: ModelWithUrl): TemplateModelDownloadState {
    const identity = identityFor(model)
    const previousModel = models.get(identity)
    if (previousModel && previousModel.url !== model.url) {
      const initial = createTemplateModelDownloadState()
      models.set(identity, model)
      states.set(identity, initial)
      nativeActivityAttempts.delete(identity)
      nativeJobs.delete(identity)
      return initial
    }

    models.set(identity, model)
    const current = states.get(identity)
    if (current) return current

    const initial = createTemplateModelDownloadState()
    states.set(identity, initial)
    return initial
  }

  function stateFor(model: ModelWithUrl): TemplateModelDownloadState {
    const identity = identityFor(model)
    const state = states.get(identity)
    if (models.get(identity)?.url !== model.url) {
      return createTemplateModelDownloadState()
    }
    return state ?? createTemplateModelDownloadState()
  }

  function applyEvent(
    model: ModelWithUrl,
    event: TemplateModelDownloadEvent
  ): void {
    const identity = identityFor(model)
    let current = initializeState(model)
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
    event: TemplateModelDownloadHostEvent,
    jobId?: string
  ): void {
    const identity = identityFor(model)
    if (jobId !== undefined && !acceptsJob(identity, event, jobId)) return
    if (event.type === 'started' || event.type === 'progress') {
      nativeActivityAttempts.set(identity, event.attempt)
    } else if (
      // Everything else is terminal. A retry only ends on a stream that was
      // seen running; attempt 1 is exempt because a transfer can finish
      // without ever reporting progress.
      event.attempt > 1 &&
      nativeActivityAttempts.get(identity) !== event.attempt
    ) {
      return
    }

    applyEvent(model, event)
  }

  /**
   * Decides whether an identified job may speak for this row's attempt.
   * Non-terminal activity claims the attempt if nothing else holds it;
   * a terminal event is only honoured from the job that made that claim.
   */
  function acceptsJob(
    identity: string,
    event: TemplateModelDownloadHostEvent,
    jobId: string
  ): boolean {
    const bound = nativeJobs.get(identity)
    const claimant =
      bound !== undefined && bound.attempt === event.attempt
        ? bound.jobId
        : undefined
    if (event.type === 'started' || event.type === 'progress') {
      if (claimant !== undefined) return claimant === jobId
      nativeJobs.set(identity, { attempt: event.attempt, jobId })
      return true
    }
    return claimant === jobId
  }

  function forMatchingModels(
    progress: { url: string; filename: string; directory?: string },
    apply: (model: ModelWithUrl, attempt: number) => void
  ): void {
    const matches: { model: ModelWithUrl; attempt: number }[] = []
    for (const [identity, model] of models) {
      if (!modelMatchesProgress(model, progress)) continue
      const attempt = activeAttempt(states.get(identity))
      if (attempt === undefined) continue
      matches.push({ model, attempt })
    }

    if (progress.directory === undefined && matches.length !== 1) return
    for (const { model, attempt } of matches) apply(model, attempt)
  }

  const stopDesktopProgress = subscribeDesktopProgress((progress) => {
    forMatchingModels(progress, (model, attempt) => {
      applyNativeEvent(
        model,
        desktopProgressEvent(progress, attempt),
        progress.id
      )
    })
  })
  let stopLegacyProgress: (() => void) | undefined

  /**
   * Desktop2 never reaches the legacy host, so its store and subscription are
   * only constructed once a dispatch actually lands there.
   */
  function ensureLegacyProgress(): void {
    stopLegacyProgress ??= subscribeLegacyProgress((download) => {
      forMatchingModels(download, (model, attempt) => {
        const event = legacyProgressEvent(download, attempt)
        if (event) applyNativeEvent(model, event)
      })
    })
  }

  function fail(model: ModelWithUrl, attempt: number): void {
    applyEvent(model, { type: 'error', attempt })
  }

  function handleOutcome(
    model: ModelWithUrl,
    attempt: number,
    outcome: ModelDownloadDispatchOutcome
  ): void {
    switch (outcome.status) {
      case 'host-requested':
        if (outcome.host === 'electron') ensureLegacyProgress()
        applyEvent(model, { type: 'started', attempt })
        // A resolved `false` is a refusal, not an acknowledgement: the sibling
        // `openModelAccessPage` documents the same convention on this bridge.
        void outcome.hostResult.then(
          (accepted) => {
            if (!accepted) fail(model, attempt)
          },
          () => fail(model, attempt)
        )
        return
      case 'browser-requested':
      case 'dispatch-failed':
        fail(model, attempt)
        return
      case 'not-dispatched':
        fail(model, attempt)
        return
      default:
        return outcome satisfies never
    }
  }

  function dispatch(model: ModelWithUrl, attempt: number): void {
    try {
      handleOutcome(
        model,
        attempt,
        dispatchDownload(model, folderPaths, { revealLegacyDownload: false })
      )
    } catch {
      fail(model, attempt)
    }
  }

  function request(model: ModelWithUrl): void {
    if (disposed) return
    const identity = identityFor(model)
    const current = initializeState(model)
    const queued = reduceTemplateModelDownloadState(current, {
      type: 'request'
    })
    if (queued === current) return

    states.set(identity, queued)
    dispatch(model, queued.attempt)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    stopDesktopProgress()
    stopLegacyProgress?.()
  }

  return { stateFor, request, dispose }
}
