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
  /**
   * One record per row identity. A URL change or a retry resets the whole
   * record, so the native bookkeeping cannot outlive the state it describes.
   */
  type TrackedRow = {
    model: ModelWithUrl
    state: TemplateModelDownloadState
    /** Attempt whose stream has reported non-terminal activity. */
    activeAttempt?: number
    /** Job holding the current attempt, where the host sends an id. */
    job?: { attempt: number; jobId: string }
    /** Jobs that delivered a terminal event, so they cannot claim again. */
    endedJobs?: ReadonlySet<string>
  }
  const rows = shallowReactive(new Map<string, TrackedRow>())

  function initializeState(model: ModelWithUrl): TemplateModelDownloadState {
    const identity = getTemplateModelDownloadIdentity(model)
    const existing = rows.get(identity)
    if (existing && existing.model.url === model.url) return existing.state

    const state = createTemplateModelDownloadState()
    rows.set(identity, { model, state })
    return state
  }

  function stateFor(model: ModelWithUrl): Readonly<TemplateModelDownloadState> {
    const identity = getTemplateModelDownloadIdentity(model)
    const row = rows.get(identity)
    if (row?.model.url !== model.url) {
      return createTemplateModelDownloadState()
    }
    return row.state
  }

  function applyEvent(
    model: ModelWithUrl,
    event: TemplateModelDownloadEvent
  ): void {
    const identity = getTemplateModelDownloadIdentity(model)
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
    const row = rows.get(identity)
    if (row) {
      rows.set(identity, {
        ...row,
        state: reduceTemplateModelDownloadState(current, event)
      })
    }
  }

  function applyNativeEvent(
    model: ModelWithUrl,
    event: TemplateModelDownloadHostEvent,
    jobId?: string
  ): void {
    const identity = getTemplateModelDownloadIdentity(model)
    if (jobId !== undefined && !acceptsJob(identity, event, jobId)) return
    if (event.type === 'started' || event.type === 'progress') {
      const row = rows.get(identity)
      if (row) rows.set(identity, { ...row, activeAttempt: event.attempt })
    } else if (
      // Everything else is terminal. A retry only ends on a stream that was
      // seen running; attempt 1 is exempt because a transfer can finish
      // without ever reporting progress.
      event.attempt > 1 &&
      rows.get(identity)?.activeAttempt !== event.attempt
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
    const row = rows.get(identity)
    if (!row) return false
    const claimant =
      row.job?.attempt === event.attempt ? row.job.jobId : undefined

    if (event.type !== 'started' && event.type !== 'progress') {
      if (claimant !== jobId) return false
      rows.set(identity, {
        ...row,
        endedJobs: new Set([...(row.endedJobs ?? []), jobId])
      })
      return true
    }
    if (claimant !== undefined) return claimant === jobId
    // A joined retry reuses a running job's id, so only an ended one is out.
    if (row.endedJobs?.has(jobId)) return false

    rows.set(identity, { ...row, job: { attempt: event.attempt, jobId } })
    return true
  }

  function forMatchingModels(
    progress: { url: string; filename: string; directory?: string },
    apply: (model: ModelWithUrl, attempt: number) => void
  ): void {
    const matches: { model: ModelWithUrl; attempt: number }[] = []
    for (const { model, state } of rows.values()) {
      if (!modelMatchesProgress(model, progress)) continue
      const attempt = activeAttempt(state)
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

  /**
   * A host result can settle after the row moved to a different URL. Reporting
   * it then would resurrect the old row through `initializeState`, so only the
   * row that is still this model's current attempt may be failed.
   */
  function fail(model: ModelWithUrl, attempt: number): void {
    const row = rows.get(getTemplateModelDownloadIdentity(model))
    if (row?.model.url !== model.url || row.state.attempt !== attempt) return
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
    const identity = getTemplateModelDownloadIdentity(model)
    const current = initializeState(model)
    const queued = reduceTemplateModelDownloadState(current, {
      type: 'request'
    })
    if (queued === current) return

    const row = rows.get(identity)
    if (row) rows.set(identity, { ...row, state: queued })
    dispatch(model, queued.attempt)
  }

  let disposed = false
  function dispose(): void {
    if (disposed) return
    disposed = true
    stopDesktopProgress()
    stopLegacyProgress?.()
  }

  return { stateFor, request, dispose }
}
