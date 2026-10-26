import type { WorkflowWorkshopModel } from '@/config/models-catalogue'

interface FileLoadingWorkflow {
  readonly model: WorkflowWorkshopModel
  /** The model file pages of the files it loads. */
  readonly fileSlugs: readonly string[]
}

/** The Hub workflows that load the file with this model file page. */
export function workflowsUsingFile(
  slug: string,
  workflows: readonly FileLoadingWorkflow[]
): WorkflowWorkshopModel[] {
  return workflows
    .filter(({ fileSlugs }) => fileSlugs.includes(slug))
    .map(({ model }) => model)
}
