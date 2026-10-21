import type {
  WorkflowWorkshopModelDetail,
  WorkshopModelDetail
} from '@/config/models-catalogue'
import { getWorkshopPageDetail } from '@/config/workshop-page-content'

function isWorkflowDetail(
  model: WorkshopModelDetail | undefined
): model is WorkflowWorkshopModelDetail {
  return model?.type === 'CLOUD' || model?.type === 'SERVERLESS'
}

// Remove once the catalog holds the static Workshop workflows' run contract.
export function withStaticRunForm(
  model: WorkshopModelDetail
): WorkshopModelDetail {
  if (
    !isWorkflowDetail(model) ||
    Object.keys(model.workflow.inputs).length ||
    model.catalogDetails?.inputMismatch
  )
    return model
  const legacy = getWorkshopPageDetail(model.slug)
  if (!isWorkflowDetail(legacy)) return model
  return {
    ...model,
    workflowId: legacy.workflowId,
    workflow: legacy.workflow,
    form: legacy.form,
    ...(model.catalogDetails
      ? { catalogDetails: { ...model.catalogDetails, runnable: true } }
      : {})
  }
}
