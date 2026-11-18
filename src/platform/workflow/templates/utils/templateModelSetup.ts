import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type {
  TemplateModelMetadataBatchResult,
  TemplateModelMetadataEntry
} from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import type { TemplateModelRequirementDetail } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { ModelFile } from '@comfyorg/graph-model/workflowSchema'
import { getModelFileKey } from '@/platform/workflow/core/utils/modelRequirements'

type TemplateModelSetupStatus =
  | 'installed'
  | 'downloadable'
  | 'manual'
  | 'unavailable'
  | 'unknown'

type TemplateModelSetupRowBase = {
  model: ModelFile
  usedBy: readonly string[]
  fileSize: number | null
  /** Unformatted; the view labels it. */
  modelDirectory: string
}

export type TemplateModelSetupRow =
  | (TemplateModelSetupRowBase & {
      status: 'manual'
      href: string
    })
  | (TemplateModelSetupRowBase & {
      status: Exclude<TemplateModelSetupStatus, 'manual'>
    })

type TemplateModelDeclarationTotal = {
  bytes: number
  isComplete: boolean
}

export type TemplateModelSetupResult = {
  rows: readonly TemplateModelSetupRow[]
  declarationTotal: TemplateModelDeclarationTotal
}

type TemplateModelSetupOptions = {
  isDownloadable: (model: ModelWithUrl) => boolean
}

function indexByIdentity<T extends { model: ModelWithUrl }>(
  entries: readonly T[]
): Map<string, T> {
  const indexed = new Map<string, T>()
  for (const entry of entries) {
    const identity = getModelFileKey(entry.model)
    if (!indexed.has(identity)) indexed.set(identity, entry)
  }
  return indexed
}

function normalizeFileSize(fileSize: number | null | undefined): number | null {
  return typeof fileSize === 'number' &&
    Number.isFinite(fileSize) &&
    fileSize >= 0
    ? fileSize
    : null
}

function deriveRow(
  { model, usedBy }: TemplateModelRequirementDetail,
  availability: ResolvedTemplateModelAvailability | undefined,
  metadata: TemplateModelMetadataEntry | undefined,
  isDownloadable: (model: ModelWithUrl) => boolean
): TemplateModelSetupRow {
  const row = {
    model,
    usedBy,
    fileSize: normalizeFileSize(metadata?.fileSize),
    modelDirectory: model.directory.trim()
  }

  if (availability?.status === 'installed') {
    return { ...row, status: 'installed' }
  }
  if (availability?.status !== 'missing') {
    return { ...row, status: 'unknown' }
  }
  if (!metadata) {
    return { ...row, status: 'unknown' }
  }
  const gatedRepoUrl = metadata.gatedRepoUrl?.trim()
  if (gatedRepoUrl) {
    return { ...row, status: 'manual', href: gatedRepoUrl }
  }
  return {
    ...row,
    status: isDownloadable(model) ? 'downloadable' : 'unavailable'
  }
}

function totalDeclarations(
  rows: readonly TemplateModelSetupRow[],
  sizeOf: (row: TemplateModelSetupRow) => number | null = (row) => row.fileSize
): TemplateModelDeclarationTotal {
  const seen = new Set<string>()
  let bytes = 0
  let isComplete = true

  for (const row of rows) {
    const identity = getModelFileKey(row.model)
    if (seen.has(identity)) continue

    seen.add(identity)
    const size = sizeOf(row)
    if (size === null) {
      isComplete = false
    } else {
      bytes += size
    }
  }

  return { bytes, isComplete }
}

type RowDownloadStatus = {
  status: string
  activity?: string
  receivedBytes?: number | null
  totalBytes?: number | null
  fraction?: number | null
}

type RowDownloads = {
  stateFor: (model: ModelWithUrl) => RowDownloadStatus
  canResume: (model: ModelWithUrl) => boolean
}

/** A row the bulk action would actually start or resume. */
export function isModelDownloadCandidate(
  row: TemplateModelSetupRow,
  { stateFor, canResume }: RowDownloads
): boolean {
  if (row.status !== 'downloadable') return false
  const state = stateFor(row.model)
  if (state.status === 'downloading' && state.activity === 'paused')
    return canResume(row.model)
  return state.status === 'idle' || state.status === 'failed'
}

/** Nothing left to satisfy: already on disk, or downloaded in this session. */
export function isModelRowComplete(
  row: TemplateModelSetupRow,
  stateFor: (model: ModelWithUrl) => RowDownloadStatus
): boolean {
  if (row.status === 'installed') return true
  return stateFor(row.model).status === 'done'
}

/**
 * What a bulk click would transfer. Shares `totalDeclarations`' identity dedupe
 * so this and the group header cannot count the same model differently.
 */
export function remainingModelDownloadTotal(
  rows: readonly TemplateModelSetupRow[],
  downloads: RowDownloads
): TemplateModelDeclarationTotal {
  return totalDeclarations(
    rows.filter((row) => isModelDownloadCandidate(row, downloads)),
    (row) => bytesLeft(row, downloads.stateFor(row.model))
  )
}

function bytesLeft(
  row: TemplateModelSetupRow,
  { receivedBytes, totalBytes, fraction }: RowDownloadStatus
): number | null {
  const received = receivedBytes ?? 0
  const size = totalBytes && totalBytes >= received ? totalBytes : row.fileSize
  if (size === null || received > size) return null
  const done = receivedBytes ?? (fraction ?? 0) * size
  return Math.ceil(size - done)
}

export function deriveTemplateModelSetup(
  requirements: readonly TemplateModelRequirementDetail[],
  availability: readonly ResolvedTemplateModelAvailability[],
  metadata: TemplateModelMetadataBatchResult,
  { isDownloadable }: TemplateModelSetupOptions
): TemplateModelSetupResult {
  const availabilityByIdentity = indexByIdentity(availability)
  const metadataByIdentity = indexByIdentity(
    metadata.status === 'completed' ? metadata.entries : []
  )
  const rows = requirements.map((requirement) => {
    const identity = getModelFileKey(requirement.model)
    return deriveRow(
      requirement,
      availabilityByIdentity.get(identity),
      metadataByIdentity.get(identity),
      isDownloadable
    )
  })

  return {
    rows,
    declarationTotal: totalDeclarations(rows)
  }
}
