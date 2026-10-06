import { workflowParts } from '@/lib/workshop/workflow-parts'
import { getRoutes } from './routes'
import { models } from './models'
import { workshopModels } from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  workflowDetailsBySlug,
  workflowModels
} from './workshop-workflow-content'

export const workshopPages = [...workshopModels, ...workflowModels]
export const workshopPagePaths = workflowModels.map((model) => model.slug)

const modelFiles = new Map(models.map((model) => [model.name, model]))

function modelFilePage(name: string) {
  const model = modelFiles.get(name)
  return model
    ? {
        directory: model.directory,
        href: `${getRoutes().models}${model.canonicalSlug ?? model.slug}/`
      }
    : undefined
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
