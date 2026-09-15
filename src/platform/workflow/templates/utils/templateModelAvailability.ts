import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getModelFileKey } from '@/platform/workflow/core/utils/modelRequirements'

type TemplateModelAvailabilityStatus = 'installed' | 'missing' | 'unknown'

type TemplateModelInventoryEntry = {
  directory: string
  name: string
}

export type TemplateModelInventorySnapshot = {
  isComplete: boolean
  models: readonly TemplateModelInventoryEntry[]
}

export type ResolvedTemplateModelAvailability = {
  model: ModelFile
  status: TemplateModelAvailabilityStatus
}

export function resolveTemplateModelAvailability(
  models: readonly ModelFile[],
  inventory: TemplateModelInventorySnapshot
): ResolvedTemplateModelAvailability[] {
  const installedModelKeys = new Set(
    inventory.models.map((model) =>
      getModelFileKey({
        directory: model.directory,
        name: model.name.replaceAll('\\', '/')
      })
    )
  )

  return models.map((model) => ({
    model,
    status: installedModelKeys.has(
      getModelFileKey({
        directory: model.directory,
        name: model.name.replaceAll('\\', '/')
      })
    )
      ? 'installed'
      : inventory.isComplete
        ? 'missing'
        : 'unknown'
  }))
}
