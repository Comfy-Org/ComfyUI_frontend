import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import type { PromptRequest } from '@comfyorg/ingest-types'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { initialWorkshopPageState } from './workshop-page-state'
import type { FieldValue, FormValues } from './workshop-playground'
import { urlUploadField } from './workshop-playground'
import { pythonLiteral } from './workshop-snippets'
import { workflowRequest } from './workflow-render'
import {
  withPartnerNodeCredential,
  workflowCloudRequest
} from './workshop-workflow-api'

function uploadPlaceholder(name: string): string {
  return `UPLOADED_${name}_FILENAME`
}

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
      inputs[field.name] = uploadPlaceholder(field.name)
  }
  return withPartnerNodeCredential(
    workflowCloudRequest(model.workflow, workflowRequest(model, inputs)),
    'api-key',
    'YOUR_API_KEY'
  )
}

export function workflowCurl(request: PromptRequest): string {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    '# Replace YOUR_API_KEY in the X-API-Key header and in extra_data.api_key_comfy_org.',
    `curl --fail-with-body --max-time 60 --request POST ${quote(`${WORKSHOP_CLOUD_BASE_URL}/api/prompt`)} \\`,
    `  --header 'X-API-Key: YOUR_API_KEY' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --data ${quote(JSON.stringify(request, null, 2))}`
  ].join('\n')
}

interface WorkflowSdkUpload {
  readonly nodeId: string
  readonly input: string
  readonly url: string
}

export interface WorkflowSdkPlan {
  readonly graph: PromptRequest['prompt']
  readonly uploads: readonly WorkflowSdkUpload[]
  readonly outputNodeIds: readonly string[]
}

function uploadUrl(value: FieldValue, name: string): string {
  const file = Array.isArray(value) ? value[0] : value
  const url = typeof file === 'object' ? file.sourceUrl : file
  return typeof url === 'string' && url.startsWith('https://')
    ? url
    : `https://example.com/replace-with-a-url/${name}`
}

function nodeInputs(node: unknown): Record<string, unknown> {
  if (typeof node !== 'object' || node === null || !('inputs' in node))
    return {}
  const { inputs } = node
  return typeof inputs === 'object' && inputs !== null
    ? Object.fromEntries(Object.entries(inputs))
    : {}
}

export function workflowSdkPlan(
  model: WorkflowWorkshopModelDetail,
  values: FormValues,
  request: PromptRequest
): WorkflowSdkPlan {
  const initial = initialWorkshopPageState(model)
  const inputs = { ...initial.values, ...values }
  const nodes = Object.entries(request.prompt)
  const uploads = initial.schema.filter(urlUploadField).flatMap((field) =>
    nodes.flatMap(([nodeId, node]) =>
      Object.entries(nodeInputs(node))
        .filter(([, value]) => value === uploadPlaceholder(field.name))
        .map(([input]) => ({
          nodeId,
          input,
          url: uploadUrl(inputs[field.name], field.name)
        }))
    )
  )
  return {
    graph: request.prompt,
    uploads,
    outputNodeIds: [
      ...new Set((model.workflow.outputs ?? []).map((output) => output.nodeId))
    ]
  }
}

export function workflowTypeScript(plan: WorkflowSdkPlan): string {
  const literal = (value: string) => JSON.stringify(value)
  return [
    '// Node 22+: npm install @comfyorg/sdk@0.4.0',
    "import { Comfy } from '@comfyorg/sdk'",
    '',
    'const apiKey = process.env.COMFY_API_KEY',
    'const client = new Comfy({ apiKey })',
    `const workflow = client.workflows.fromJson(${JSON.stringify(plan.graph, null, 2)})`,
    ...plan.uploads.map(
      (upload) =>
        `workflow.setInput(${literal(upload.nodeId)}, ${literal(upload.input)}, await client.assets.fromUrl(${literal(upload.url)}))`
    ),
    '',
    '// run() also passes apiKey to the partner nodes in this workflow.',
    'const job = await client.run(workflow, { apiKey })',
    ...plan.outputNodeIds.map(
      (nodeId) =>
        `for (const output of job.getOutputs(${literal(nodeId)})) await output.toFile(output.name)`
    )
  ].join('\n')
}

export function workflowPython(plan: WorkflowSdkPlan): string {
  const literal = (value: string) => JSON.stringify(value)
  return [
    '# Python 3.10+: pip install comfy-sdk==0.4.0',
    'import os',
    '',
    'from comfy_sdk import Comfy',
    '',
    'api_key = os.environ["COMFY_API_KEY"]',
    'client = Comfy(api_key=api_key)',
    `workflow = client.workflows.from_json(${pythonLiteral(plan.graph)})`,
    ...plan.uploads.map(
      (upload) =>
        `workflow.set_input(${literal(upload.nodeId)}, ${literal(upload.input)}, client.assets.from_url(${literal(upload.url)}))`
    ),
    '',
    '# run() also passes api_key to the partner nodes in this workflow.',
    'job = client.run(workflow, api_key=api_key)',
    ...plan.outputNodeIds.flatMap((nodeId) => [
      `for output in job.get_outputs(${literal(nodeId)}):`,
      '    output.to_file(output.name)'
    ])
  ].join('\n')
}
