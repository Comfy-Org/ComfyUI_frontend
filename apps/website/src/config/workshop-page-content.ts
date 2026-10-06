import { modelFileHref } from '@/lib/workshop/model-file-href'
import { workflowsUsingFile } from '@/lib/workshop/model-file-usage'
import { modelFileNames, workflowParts } from '@/lib/workshop/workflow-parts'
import { models } from './models'
import { workshopModels } from './workshop-browse-content'
import { isWorkshopInBuild } from './workshop-release'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  workflowDetailsBySlug,
  workflowModels
} from './workshop-workflow-content'

export const workshopPages = [...workshopModels, ...workflowModels]
export const workshopPagePaths = workflowModels.map((model) => model.slug)

const modelFiles = new Map(models.map((model) => [model.name, model]))

const modelFileSlug = (name: string) => {
  const model = modelFiles.get(name)
  return model && (model.canonicalSlug ?? model.slug)
}

function modelFilePage(name: string) {
  const model = modelFiles.get(name)
  return model
    ? {
        directory: model.directory,
        href: modelFileHref(
          model.canonicalSlug ?? model.slug,
          isWorkshopInBuild()
        )
      }
    : undefined
}

const fileLoadingWorkflows = workflowModels.flatMap((model) => {
  const workflow = workflowDetailsBySlug.get(model.slug)
  return workflow
    ? [
        {
          model,
          fileSlugs: modelFileNames(workflow).flatMap(
            (name) => modelFileSlug(name) ?? []
          )
        }
      ]
    : []
})

/** The Hub workflows that load the file with this model file page. */
export function hubWorkflowsUsingFile(slug: string) {
  return workflowsUsingFile(slug, fileLoadingWorkflows)
}

export function getWorkshopPageDetail(slug: string) {
  const workflow = workflowDetailsBySlug.get(slug)
  return workflow
    ? {
        ...workflow,
        parts: workflowParts(workflow, workshopModels, modelFilePage)
      }
    : getRouterWorkshopModelDetail(slug)
}
