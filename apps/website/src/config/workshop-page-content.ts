import {
  routerWorkshopModelPaths,
  workshopModels
} from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  workflowDetailsBySlug,
  workflowModels
} from './workshop-workflow-content'

export const workshopPages = [...workshopModels, ...workflowModels]
export const workshopPagePaths = [
  ...routerWorkshopModelPaths,
  ...workflowModels.map((model) => model.slug)
]

export function getWorkshopPageDetail(slug: string) {
  return workflowDetailsBySlug.get(slug) ?? getRouterWorkshopModelDetail(slug)
}
