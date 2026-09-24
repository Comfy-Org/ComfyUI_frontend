import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'
import { workshopIdempotencyKey } from './workshop-snippets'
import type { FieldSchema, FormValues } from './workshop-playground'
import { urlUploadField, validateForm } from './workshop-playground'
import { validateWorkshopInput } from './workshop-json-schema'
import type { WorkshopUrlEncoder } from './workshop-url-input'
import { resolveWorkshopUrlInputs } from './workshop-url-input'
import type { WorkflowApi, WorkflowApiOptions } from './workshop-workflow-api'
import {
  createWorkflowApi,
  WorkshopWorkflowError
} from './workshop-workflow-api'
import {
  WORKFLOW_CONTROL_BYTES,
  WORKFLOW_FILE_BYTES,
  WORKFLOW_INPUT_BYTES,
  workflowHttpsUrl,
  workflowOutputs,
  workflowSettled
} from './workshop-workflow-response'
import type {
  WorkflowRun,
  WorkflowRunRequest,
  WorkflowRunSummary
} from './workshop-workflow-response'
import { createWorkflowUploader } from './workshop-workflow-upload'

export interface WorkflowAttempt {
  readonly request: WorkflowRunRequest
  readonly idempotencyKey: string
}

export interface WorkflowRenderOptions extends WorkflowApiOptions {
  readonly model: WorkflowWorkshopModelDetail
  readonly signal?: AbortSignal
  readonly api?: WorkflowApi
  readonly uploadFile?: WorkshopUrlEncoder
  readonly attempt?: WorkflowAttempt
  readonly runId?: string
  readonly idempotencyKey?: string
  readonly onPrepared?: (attempt: WorkflowAttempt) => void | Promise<void>
  readonly onAdmitted?: (run: WorkflowRunSummary) => void | Promise<void>
  readonly onUpdate?: (result: WorkflowRun) => void
}

function scalarInputs(values: FormValues): WorkflowRunRequest['appInputs'] {
  return Object.fromEntries(
    Object.entries(values).flatMap(([name, value]) => {
      if (value === undefined) return []
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      )
        throw new WorkshopWorkflowError('invalid_input', { [name]: 'rejected' })
      if (
        typeof value === 'number' &&
        (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
      )
        throw new WorkshopWorkflowError('invalid_input', {
          [name]: 'outOfRange'
        })
      return [[name, value]]
    })
  )
}

function validateMediaSelection(
  schema: readonly FieldSchema[],
  values: FormValues
) {
  const selected = schema.filter(
    (field) =>
      urlUploadField(field) &&
      values[field.name] !== undefined &&
      values[field.name] !== ''
  )
  const bytes = selected.reduce(
    (total, field) => total + mediaInputBytes(field.name, values[field.name]),
    0
  )
  if (bytes > WORKFLOW_INPUT_BYTES || selected.length > 16)
    throw new WorkshopWorkflowError('invalid_input')
}

function mediaInputBytes(name: string, value: FormValues[string]): number {
  if (typeof value === 'string') {
    if (!workflowHttpsUrl.safeParse(value).success)
      throw new WorkshopWorkflowError('invalid_input', { [name]: 'badType' })
    return 0
  }
  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !(value.file instanceof File)
  )
    throw new WorkshopWorkflowError('invalid_input', { [name]: 'badType' })
  if (value.file.size < 1 || value.file.size > WORKFLOW_FILE_BYTES)
    throw new WorkshopWorkflowError('invalid_input', { [name]: 'tooLarge' })
  return value.file.size
}

export async function prepareWorkflowRender(
  model: WorkflowWorkshopModelDetail,
  inputs: FormValues,
  signal: AbortSignal,
  uploadFile?: WorkshopUrlEncoder
): Promise<WorkflowRunRequest> {
  signal.throwIfAborted()
  if (model.type !== 'CLOUD' || model.incompleteReason)
    throw new WorkshopWorkflowError('definition_incompatible')
  const initial = initialWorkshopPageState(model)
  const values = { ...initial.values, ...inputs }
  for (const name of Object.keys(inputs)) {
    if (!initial.schema.some((field) => field.name === name))
      throw new WorkshopWorkflowError('invalid_input', { [name]: 'rejected' })
  }
  const errors = validateForm(initial.schema, values)
  if (Object.keys(errors).length)
    throw new WorkshopWorkflowError('invalid_input', errors)
  validateMediaSelection(initial.schema, values)
  let uploadBytes = 0
  const resolved = await resolveWorkshopUrlInputs(
    initial.schema,
    values,
    signal,
    uploadFile &&
      (async (file, uploadSignal) => {
        uploadBytes += file.size
        if (uploadBytes > WORKFLOW_INPUT_BYTES)
          throw new WorkshopWorkflowError('invalid_input')
        return uploadFile(file, uploadSignal)
      }),
    true
  )
  signal.throwIfAborted()
  return workflowRequest(model, resolved)
}

export function workflowRequest(
  model: WorkflowWorkshopModelDetail,
  inputs: FormValues
): WorkflowRunRequest {
  const appInputs = scalarInputs(inputs)
  if (!validateWorkshopInput(appInputs, model.workflow.inputSchema))
    throw new WorkshopWorkflowError('invalid_input')
  const request = {
    workflowId: model.workflow.id,
    definitionVersion: model.workflow.definitionVersion,
    appInputs
  }
  if (
    new TextEncoder().encode(JSON.stringify(request)).byteLength >
    WORKFLOW_CONTROL_BYTES
  )
    throw new WorkshopWorkflowError('payload_too_large')
  return request
}

function waitForObservation(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 2000)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export async function renderWorkflow(
  slug: string,
  inputs: FormValues = {},
  options: WorkflowRenderOptions
) {
  const signal = options.signal ?? new AbortController().signal
  signal.throwIfAborted()
  if (slug !== options.model.slug || options.model.type !== 'CLOUD')
    throw new WorkshopWorkflowError('definition_incompatible')
  const api = options.api ?? createWorkflowApi(options)
  let id = options.runId
  if (!id) {
    const attempt = options.attempt ?? {
      request: await prepareWorkflowRender(
        options.model,
        inputs,
        signal,
        options.uploadFile ?? createWorkflowUploader(api, options.fetch)
      ),
      idempotencyKey: options.idempotencyKey ?? workshopIdempotencyKey()
    }
    if (attempt.request.workflowId !== options.model.workflowId)
      throw new WorkshopWorkflowError('invalid_request')
    await options.onPrepared?.(attempt)
    signal.throwIfAborted()
    const run = await api.submit(
      attempt.request,
      attempt.idempotencyKey,
      signal
    )
    await options.onAdmitted?.(run)
    signal.throwIfAborted()
    id = run.id
  }
  for (;;) {
    const result = await api.read(id, signal)
    if (result.run.workflowId !== options.model.workflowId)
      throw new WorkshopWorkflowError('response')
    options.onUpdate?.(result)
    signal.throwIfAborted()
    if (workflowSettled(result)) {
      return {
        slug,
        workflowId: result.run.workflowId,
        run: result,
        outputs: workflowOutputs(result)
      }
    }
    await waitForObservation(signal)
  }
}
