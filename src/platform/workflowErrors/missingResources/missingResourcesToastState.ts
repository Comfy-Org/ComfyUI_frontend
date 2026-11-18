import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { isActiveDownload } from '@/platform/workflowErrors/missingModel/missingModelDownloadState'
import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadState'
import { toDownloadableModel } from '@/platform/workflowErrors/missingModel/missingModelViewUtils'
import { isModelUrlAllowlisted } from '@/platform/workflowErrors/missingModel/modelUrlAllowlist'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

export interface TrackedModel {
  key: string
  model: ModelWithUrl
  download: MissingModelDownloadState
  stillMissing: boolean
  sizeBytes: number | undefined
  gatedRepoUrl: string | undefined
}

/** A missing model the toast lists but cannot download. */
export interface UnavailableModel {
  key: string
  name: string
  directory: string | null
  reason: 'noUrl' | 'noDirectory' | 'unsupportedSource' | 'unsupportedFile'
}

export type MissingResourcesToastState =
  | { kind: 'hidden' }
  | {
      kind: 'needsDownload'
      missing: number
      pending: number
      sizeBytes: number | null
    }
  | {
      kind: 'downloading'
      finished: number
      total: number
      fraction: number
      paused: boolean
      bytes: DownloadedBytes | null
      startable: number
      startableBytes: number | null
    }
  | { kind: 'failed'; failed: number }
  | { kind: 'needsAttention'; count: number }
  | { kind: 'ready' }

export interface DownloadedBytes {
  received: number
  total: number
}

export type TrackedModelPhase = 'waiting' | 'active' | 'failed' | 'finished'

export function trackedModelPhase(tracked: TrackedModel): TrackedModelPhase {
  const { download } = tracked
  if (isActiveDownload(download)) return 'active'
  if (!tracked.stillMissing) return 'finished'
  if (download.status === 'failed') return 'failed'
  if (download.status === 'done') return 'finished'
  return 'waiting'
}

/** Whether the toast should keep listing the model: still missing, downloading, or downloaded in this session. */
export function isTrackedModelRelevant(tracked: TrackedModel): boolean {
  return (
    tracked.stillMissing ||
    tracked.download.status === 'done' ||
    isActiveDownload(tracked.download)
  )
}

function unavailableReason(
  url: string | undefined,
  directory: string | null
): UnavailableModel['reason'] {
  if (!url) return 'noUrl'
  if (!directory) return 'noDirectory'
  return isModelUrlAllowlisted(url) ? 'unsupportedFile' : 'unsupportedSource'
}

/** Missing models in the groups that have no URL the editor may download from. */
export function toUnavailableModels(
  groups: readonly MissingModelGroup[]
): UnavailableModel[] {
  return groups.flatMap((group) =>
    group.models.flatMap((model) =>
      toDownloadableModel(model)
        ? []
        : [
            {
              key: `${group.directory ?? ''}:${model.name}`,
              name: model.name,
              directory: group.directory,
              reason: unavailableReason(
                model.representative.url,
                group.directory
              )
            }
          ]
    )
  )
}

function progressOf(tracked: TrackedModel): number {
  const { download } = tracked
  if (trackedModelPhase(tracked) === 'finished') return 1
  if (download.status !== 'downloading') return 0
  return Math.min(1, Math.max(0, download.fraction ?? 0))
}

function expectedBytes(tracked: TrackedModel): number | undefined {
  const { download } = tracked
  if (download.status === 'downloading' && download.totalBytes)
    return download.totalBytes
  return tracked.sizeBytes
}

function receivedBytes(
  tracked: TrackedModel,
  total: number
): number | undefined {
  const { download } = tracked
  if (trackedModelPhase(tracked) === 'finished') return total
  if (download.status !== 'downloading') return 0
  if (download.receivedBytes !== null)
    return Math.min(download.receivedBytes, total)
  return download.fraction === null ? undefined : download.fraction * total
}

/** Bytes received so far out of the model's expected size, when both are known. */
export function trackedModelBytes(
  tracked: TrackedModel
): DownloadedBytes | null {
  const total = expectedBytes(tracked)
  if (total === undefined) return null
  const received = receivedBytes(tracked, total)
  return received === undefined ? null : { received, total }
}

function combinedBytes(
  models: readonly TrackedModel[]
): DownloadedBytes | null {
  const bytes = models.map(trackedModelBytes)
  if (!bytes.every((value): value is DownloadedBytes => value !== null))
    return null
  return bytes.reduce(
    (sum, value) => ({
      received: sum.received + value.received,
      total: sum.total + value.total
    }),
    { received: 0, total: 0 }
  )
}

function totalSize(models: readonly TrackedModel[]): number | null {
  const sizes = models.map((tracked) => tracked.sizeBytes)
  if (!sizes.every((size): size is number => size !== undefined)) return null
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return total > 0 ? total : null
}

/** Last phase seen for each model in the running download batch. */
export type DownloadBatch = ReadonlyMap<string, TrackedModelPhase>

const EMPTY_BATCH: DownloadBatch = new Map()

function batchPhase(
  previous: TrackedModelPhase | undefined,
  current: TrackedModelPhase
): TrackedModelPhase | undefined {
  if (current === 'active') return current
  return previous !== undefined && current === 'finished' ? current : undefined
}

/** The models whose progress the toast sums: every active download, plus those that finished while the batch was still running. */
export function nextDownloadBatch(
  previous: DownloadBatch,
  tracked: readonly TrackedModel[]
): DownloadBatch {
  if (!tracked.some((model) => trackedModelPhase(model) === 'active'))
    return EMPTY_BATCH
  return new Map(
    tracked.flatMap((model) => {
      const phase = batchPhase(
        previous.get(model.key),
        trackedModelPhase(model)
      )
      return phase ? [[model.key, phase] as const] : []
    })
  )
}

/** Models a download-all click would start: waiting or failed. */
export function startableModels(
  tracked: readonly TrackedModel[]
): TrackedModel[] {
  return tracked.filter((model) => {
    const phase = trackedModelPhase(model)
    return phase === 'waiting' || phase === 'failed'
  })
}

/** Picks the single state the missing resources toast shows; `unavailable` counts missing models without a usable download URL. */
export function deriveMissingResourcesToastState(
  tracked: readonly TrackedModel[],
  unavailable: number,
  batch: DownloadBatch = EMPTY_BATCH
): MissingResourcesToastState {
  if (tracked.length === 0 && unavailable === 0) return { kind: 'hidden' }

  const phases = tracked.map(trackedModelPhase)
  const active = tracked.filter((_, index) => phases[index] === 'active')
  const startable = startableModels(tracked)
  const failed = startable.filter(
    ({ download }) => download.status === 'failed'
  ).length

  if (active.length > 0) {
    const inProgress = tracked.filter(
      (model, index) =>
        phases[index] === 'active' ||
        (batch.has(model.key) && phases[index] === 'finished')
    )

    const bytes = combinedBytes(inProgress)
    return {
      kind: 'downloading',
      finished: inProgress.length - active.length,
      total: inProgress.length,
      fraction:
        bytes && bytes.total > 0
          ? bytes.received / bytes.total
          : inProgress.reduce((sum, model) => sum + progressOf(model), 0) /
            inProgress.length,
      paused: active.every(
        ({ download }) => download.status === 'downloading' && download.paused
      ),
      bytes,
      startable: startable.length,
      startableBytes: totalSize(startable)
    }
  }

  if (startable.length > failed) {
    return {
      kind: 'needsDownload',
      missing: startable.length + unavailable,
      pending: startable.length,
      sizeBytes: totalSize(startable)
    }
  }

  if (failed > 0) return { kind: 'failed', failed }

  if (unavailable > 0) return { kind: 'needsAttention', count: unavailable }

  return { kind: 'ready' }
}

interface MissingModelsToastCoverageInput {
  toastActive: boolean
  missingModels: boolean
  missingNodes: boolean
  missingMedia: boolean
  runErrors: boolean
}

/** Whether the missing resources toast already lists every issue, so the error overlay would only repeat it. */
export function isCoveredByMissingModelsToast(
  input: MissingModelsToastCoverageInput
): boolean {
  return (
    input.toastActive &&
    input.missingModels &&
    !input.missingNodes &&
    !input.missingMedia &&
    !input.runErrors
  )
}
