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
// The API JSON download and output type still come from the record.
export function withStaticRunForm(
  model: WorkshopModelDetail
): WorkshopModelDetail {
  if (
    !isWorkflowDetail(model) ||
    !model.catalogDetails ||
    Object.keys(model.workflow.inputs).length ||
    model.catalogDetails.runnableSetting === false ||
    model.catalogDetails.inputMismatch
  )
    return model
  const legacy = getWorkshopPageDetail(model.slug)
  if (!isWorkflowDetail(legacy) || legacy.type !== model.type) return model
  return {
    ...model,
    workflowId: legacy.workflowId,
    workflow: legacy.workflow,
    form: legacy.form,
    examples: legacy.examples,
    defaults: legacy.defaults,
    catalogDetails: { ...model.catalogDetails, runnable: true }
  }
}
