import type { WorkshopModelDetail } from '@/config/models-catalogue'
import { workflowRunsHere } from '@/config/workflow-render'
import { canRunModel } from '@/lib/workshop/cinematic-studio/gate'

/** The ways a model or workflow page can really be used from the Hub. */
export interface PagePaths {
  readonly run: boolean
  readonly api: boolean
}

export function pagePaths(model: WorkshopModelDetail): PagePaths {
  if (model.routerId === undefined) {
    const runs = workflowRunsHere(model)
    return { run: runs, api: runs }
  }
  return { run: canRunModel(model), api: !!model.execution }
}
