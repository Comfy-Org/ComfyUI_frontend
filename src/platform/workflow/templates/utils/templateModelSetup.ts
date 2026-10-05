import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import type {
  TemplateModelMetadataBatchResult,
  TemplateModelMetadataEntry
} from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import type { TemplateModelRequirementDetail } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
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
  rows: readonly TemplateModelSetupRow[]
): TemplateModelDeclarationTotal {
  const seen = new Set<string>()
  let bytes = 0
  let isComplete = true

  for (const row of rows) {
    const identity = getModelFileKey(row.model)
    if (seen.has(identity)) continue

    seen.add(identity)
    if (row.fileSize === null) {
      isComplete = false
    } else {
      bytes += row.fileSize
    }
  }

  return { bytes, isComplete }
}

/** The state a row's own download is in, as the view's row-downloads reports it. */
type RowDownloadStatus = { status: string }

/**
 * A row the bulk action would actually start: offered for download, and not
 * already running or finished. Everything else - installed, unavailable,
 * manual, unknown, queued, starting, downloading, done - falls out of these two
 * conditions rather than being listed, so the list cannot drift from the rule.
 */
export function isModelDownloadCandidate(
  row: TemplateModelSetupRow,
  stateFor: (model: ModelWithUrl) => RowDownloadStatus
): boolean {
  if (row.status !== 'downloadable') return false
  const state = stateFor(row.model)
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
 * so a model declared twice is not charged twice, and so this total and the
 * group header's cannot count the same rows differently. `isComplete` is false
 * when any candidate has no declared size; the caller withholds the figure then
 * rather than showing a partial one.
 */
export function remainingModelDownloadTotal(
  rows: readonly TemplateModelSetupRow[],
  stateFor: (model: ModelWithUrl) => RowDownloadStatus
): TemplateModelDeclarationTotal {
  return totalDeclarations(
    rows.filter((row) => isModelDownloadCandidate(row, stateFor))
  )
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
