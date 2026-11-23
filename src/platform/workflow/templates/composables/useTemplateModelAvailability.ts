import type { ModelFile } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import { resolveTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import { ResourceState, useModelStore } from '@/stores/modelStore'

export function useTemplateModelAvailability() {
  const modelStore = useModelStore()

  /** `refresh` re-reads each referenced folder instead of trusting the session cache. */
  async function resolveAvailability(
    models: readonly ModelFile[],
    { refresh = false }: { refresh?: boolean } = {}
  ) {
    const directories = [...new Set(models.map((model) => model.directory))]
    let isComplete = directories.length === 0

    try {
      if (directories.length > 0 && modelStore.modelFolders.length === 0) {
        await modelStore.loadModelFolders()
      }

      const folderResults = await Promise.allSettled(
        directories.map(async (directory) => {
          if (refresh) await modelStore.refreshModelFolder(directory)
          return modelStore.getLoadedModelFolder(directory)
        })
      )
      const failure = folderResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      if (failure) {
        reportError(failure.reason, {
          surface: 'graph',
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
        surface: 'graph',
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
