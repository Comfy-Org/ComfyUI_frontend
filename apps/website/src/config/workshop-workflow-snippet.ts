import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import type { PromptRequest } from '@comfyorg/ingest-types'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { initialWorkshopPageState } from './workshop-page-state'
import type { FormValues } from './workshop-playground'
import { urlUploadField } from './workshop-playground'
import { workflowRequest } from './workflow-render'
import { workflowCloudRequest } from './workshop-workflow-api'

export function workflowSnippetRequest(
  model: WorkflowWorkshopModelDetail,
  values: FormValues
) {
  const initial = initialWorkshopPageState(model)
  const inputs = { ...initial.values, ...values }
  for (const field of initial.schema) {
    if (
      urlUploadField(field) &&
      (field.required || inputs[field.name] !== undefined)
    )
      inputs[field.name] = `UPLOADED_${field.name}_FILENAME`
  }
  return workflowCloudRequest(model.workflow, workflowRequest(model, inputs))
}

export function workflowCurl(request: PromptRequest): string {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    `curl --fail-with-body --max-time 60 --request POST ${quote(`${WORKSHOP_CLOUD_BASE_URL}/api/prompt`)} \\`,
    `  --header 'X-API-Key: YOUR_API_KEY' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --data ${quote(JSON.stringify(request, null, 2))}`
  ].join('\n')
}
