import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import type {
  TemplateModelMetadataBatchResult,
  TemplateModelMetadataEntry
} from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import type { TemplateModelRequirementDetail } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

type TemplateModelSetupStatus =
  | 'installed'
  | 'downloadable'
  | 'manual'
  | 'unavailable'
  | 'unknown'

type TemplateModelTypeKey =
  | 'model'
  | 'checkpoint'
  | 'diffusionModel'
  | 'textEncoder'
  | 'vae'
  | 'lora'

type TemplateModelType =
  | { kind: 'known'; key: TemplateModelTypeKey }
  | { kind: 'directory'; raw: string }

type TemplateModelSetupRowBase = {
  model: ModelFile
  usedBy: readonly string[]
  fileSize: number | null
  modelType: TemplateModelType
}

export type TemplateModelSetupRow =
  | (TemplateModelSetupRowBase & {
      status: 'manual'
      href: string
    })
  | (TemplateModelSetupRowBase & {
      status: Exclude<TemplateModelSetupStatus, 'manual'>
    })

type TemplateModelSetupTotal = {
  bytes: number
  isComplete: boolean
}

export type TemplateModelSetupResult = {
  rows: readonly TemplateModelSetupRow[]
  remainingDownload: TemplateModelSetupTotal
  rowTotal: TemplateModelSetupTotal
}

type TemplateModelSetupOptions = {
  isDownloadable: (model: ModelWithUrl) => boolean
}

const modelTypeKeys: Readonly<Record<string, TemplateModelTypeKey>> = {
  checkpoints: 'checkpoint',
  diffusion_models: 'diffusionModel',
  text_encoders: 'textEncoder',
  vae: 'vae',
  loras: 'lora'
}

function modelIdentity({ name, directory }: ModelWithUrl): string {
  return JSON.stringify([name, directory])
}

function indexByIdentity<T extends { model: ModelWithUrl }>(
  entries: readonly T[]
): Map<string, T> {
  const indexed = new Map<string, T>()
  for (const entry of entries) {
    const identity = modelIdentity(entry.model)
    if (!indexed.has(identity)) indexed.set(identity, entry)
  }
  return indexed
}

function deriveModelType(directory: string): TemplateModelType {
  const normalized = directory.trim()
  if (!normalized) return { kind: 'known', key: 'model' }

  const knownKey = modelTypeKeys[normalized]
  if (knownKey) return { kind: 'known', key: knownKey }

  return { kind: 'directory', raw: normalized }
}

function deriveRow(
  { model, usedBy }: TemplateModelRequirementDetail,
  availability: ResolvedTemplateModelAvailability | undefined,
  metadata: TemplateModelMetadataEntry | undefined,
  isDownloadable: (model: ModelWithUrl) => boolean
): TemplateModelSetupRow {
  const modelType = deriveModelType(model.directory)
  const row = {
    model,
    usedBy,
    fileSize: metadata?.fileSize ?? null,
    modelType
  }

  if (availability?.status === 'installed') {
    return { ...row, status: 'installed' }
  }
  if (availability?.status !== 'missing') {
    return { ...row, status: 'unknown' }
  }
  if (!metadata || metadata.resolution === 'failed') {
    return { ...row, status: 'unknown' }
  }
  if (metadata.gatedRepoUrl?.trim()) {
    return { ...row, status: 'manual', href: metadata.gatedRepoUrl }
  }
  return {
    ...row,
    status: isDownloadable(model) ? 'downloadable' : 'unavailable'
  }
}

function totalRows(
  rows: readonly TemplateModelSetupRow[],
  include: (row: TemplateModelSetupRow) => boolean
): TemplateModelSetupTotal {
  const seen = new Set<string>()
  let bytes = 0
  let isComplete = true

  for (const row of rows) {
    const identity = modelIdentity(row.model)
    if (seen.has(identity) || !include(row)) continue

    seen.add(identity)
    if (row.fileSize === null) {
      isComplete = false
    } else {
      bytes += row.fileSize
    }
  }

  return { bytes, isComplete }
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
    const identity = modelIdentity(requirement.model)
    return deriveRow(
      requirement,
      availabilityByIdentity.get(identity),
      metadataByIdentity.get(identity),
      isDownloadable
    )
  })

  return {
    rows,
    remainingDownload: totalRows(rows, (row) => row.status === 'downloadable'),
    rowTotal: totalRows(rows, () => true)
  }
}
