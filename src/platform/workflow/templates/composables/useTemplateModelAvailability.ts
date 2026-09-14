import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { reportError } from '@/platform/telemetry/reportError'
import { resolveTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import { ResourceState, useModelStore } from '@/stores/modelStore'

export function useTemplateModelAvailability() {
  const modelStore = useModelStore()

  async function resolveAvailability(models: readonly ModelFile[]) {
    const directories = [...new Set(models.map((model) => model.directory))]
    let isComplete = directories.length === 0

    try {
      if (directories.length > 0 && modelStore.modelFolders.length === 0) {
        await modelStore.loadModelFolders()
      }

      const folderResults = await Promise.allSettled(
        directories.map((directory) =>
          modelStore.getLoadedModelFolder(directory)
        )
      )
      const failure = folderResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      if (failure) {
        reportError(failure.reason, {
          errorType: 'workflow_template_model_inventory_failed',
          level: 'warning'
        })
      }
      isComplete = folderResults.every(
        (result) =>
          result.status === 'fulfilled' &&
          result.value?.state === ResourceState.Loaded
      )
    } catch (error) {
      reportError(error, {
        errorType: 'workflow_template_model_inventory_failed',
        level: 'warning'
      })
    }

    return resolveTemplateModelAvailability(models, {
      isComplete,
      models: modelStore.models.map((model) => ({
        directory: model.directory,
        name: model.normalized_file_name
      }))
    })
  }

  return { resolveAvailability }
}
