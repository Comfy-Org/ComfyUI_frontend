import type {
  WorkshopModel,
  WorkshopModelDetail
} from '@/config/models-catalogue'

/** Whether a visitor can start a run of this model from its Hub page. */
export function runsHere(model: WorkshopModel | WorkshopModelDetail): boolean {
  if (model.routerId === undefined || model.incompleteReason) return false
  if (import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN !== '1') return false
  return !('examples' in model) || !!model.execution
}
