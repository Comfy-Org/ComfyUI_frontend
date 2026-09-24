import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { initialWorkshopPageState } from './workshop-page-state'
import type { FormValues } from './workshop-playground'
import { urlUploadField } from './workshop-playground'
import { workflowRequest } from './workflow-render'

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
      inputs[field.name] =
        `https://upload.invalid/${encodeURIComponent(field.name)}`
  }
  return workflowRequest(model, inputs)
}

export function workflowCurl(
  request: ReturnType<typeof workflowRequest>,
  idempotencyKey: string
): string {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    `curl --fail-with-body --max-time 60 --request POST ${quote(`${WORKSHOP_ROUTER_BASE_URL}/v1/workshop/workflow-runs`)} \\`,
    `  --header 'Authorization: Bearer YOUR_API_KEY' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --header ${quote(`Idempotency-Key: ${idempotencyKey}`)} \\`,
    `  --data ${quote(JSON.stringify(request, null, 2))}`
  ].join('\n')
}
