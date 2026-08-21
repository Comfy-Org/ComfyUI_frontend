import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

export type TemplateModelAvailabilityStatus =
  | 'installed'
  | 'missing'
  | 'unknown'

export type TemplateModelInventoryEntry = {
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

function modelKey(directory: string, name: string): string {
  return `${directory}\0${name.replaceAll('\\', '/')}`
}

export function resolveTemplateModelAvailability(
  models: readonly ModelFile[],
  inventory: TemplateModelInventorySnapshot
): ResolvedTemplateModelAvailability[] {
  const installedModelKeys = new Set(
    inventory.models.map((model) => modelKey(model.directory, model.name))
  )

  return models.map((model) => ({
    model,
    status: installedModelKeys.has(modelKey(model.directory, model.name))
      ? 'installed'
      : inventory.isComplete
        ? 'missing'
        : 'unknown'
  }))
}
