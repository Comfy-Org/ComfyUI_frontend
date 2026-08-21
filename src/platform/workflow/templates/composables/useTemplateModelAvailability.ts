import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resolveTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import { ResourceState, useModelStore } from '@/stores/modelStore'

export function useTemplateModelAvailability() {
  const modelStore = useModelStore()

  async function resolveAvailability(models: readonly ModelFile[]) {
    let didLoadModels = true
    try {
      await modelStore.loadModels()
    } catch {
      didLoadModels = false
    }

    return resolveTemplateModelAvailability(models, {
      isComplete:
        didLoadModels &&
        modelStore.modelFolders.every(
          (folder) => folder.state === ResourceState.Loaded
        ),
      models: modelStore.models.map((model) => ({
        directory: model.directory,
        name: model.normalized_file_name
      }))
    })
  }

  return { resolveAvailability }
}
