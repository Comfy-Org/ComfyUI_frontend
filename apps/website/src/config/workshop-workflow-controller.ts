import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import type { FormValues } from './workshop-playground'
import { WorkshopRouterError } from './workshop-router-errors'
import type { WorkflowApi } from './workshop-workflow-api'
import { WorkshopWorkflowError } from './workshop-workflow-api'
import { renderWorkflow } from './workflow-render'
import type {
  SavedWorkflow,
  WorkflowStorage
} from './workshop-workflow-storage'
import { savedWorkflowRunId } from './workshop-workflow-storage'
import type { WorkflowAccess, WorkflowRun } from './workshop-workflow-response'
import { workflowOutputState } from './workshop-workflow-response'
import type { WorkflowMediaUploader } from './workshop-workflow-upload'
import { transitionWorkflow } from './workshop-workflow-state'
import type { WorkflowEvent, WorkflowState } from './workshop-workflow-state'

function admissionRejected(error: WorkshopWorkflowError): boolean {
  if (error.status === undefined) return false
  return (
    error.status >= 400 &&
    error.status < 500 &&
    [
      'invalid_request',
      'invalid_input',
      'payload_too_large',
      'unsupported_media_type',
      'not_authenticated',
      'access_denied',
      'insufficient_credits',
      'rate_limited',
      'workflow_not_found',
      'definition_changed',
      'definition_incompatible',
      'admission_disabled'
    ].includes(error.code)
  )
}

function normalizeFailure(error: unknown): WorkshopWorkflowError {
  if (error instanceof WorkshopWorkflowError) return error
  if (error instanceof WorkshopRouterError)
    return new WorkshopWorkflowError(
      error.reason === 'validation' ? 'invalid_input' : 'delivery_failed',
      error.fieldErrors
    )
  return new WorkshopWorkflowError('network')
}

function withOutputAccess(
  observation: WorkflowRun,
  outputId: string,
  access: WorkflowAccess
): WorkflowRun {
  const selected = observation.outputs.find((output) => output.id === outputId)
  if (!selected || !access.mimeType.startsWith(`${selected.kind}/`))
    throw new WorkshopWorkflowError('response')
  const outputs: WorkflowRun['outputs'] = observation.outputs.map((output) =>
    output.id === outputId
      ? { ...output, delivery: { state: 'ready', access } }
      : output
  )
  return {
    ...observation,
    run: { ...observation.run, outputState: workflowOutputState(outputs) },
    outputs
  }
}

export function createWorkflowController(options: {
  readonly model: WorkflowWorkshopModelDetail
  readonly api: WorkflowApi
  readonly storage: WorkflowStorage
  readonly uploadFile?: WorkflowMediaUploader
  readonly onChange: (state: WorkflowState) => void
}) {
  let state: WorkflowState = { phase: 'idle' }
  let operation: AbortController | undefined
  const lifetime = new AbortController()

  function dispatch(event: WorkflowEvent) {
    if (lifetime.signal.aborted) return
    state = transitionWorkflow(state, event)
    options.onChange(state)
  }

  function record(): SavedWorkflow | undefined {
    return 'record' in state ? state.record : undefined
  }

  function persist(event: WorkflowEvent) {
    const next = transitionWorkflow(state, event)
    if (event.type === 'admitted') dispatch(event)
    if ('record' in next) options.storage.write(next.record)
    if (event.type !== 'admitted') dispatch(event)
  }

  function failure(error: unknown) {
    let cause = normalizeFailure(error)
    if (record()?.stage === 'intent' && admissionRejected(cause)) {
      try {
        options.storage.clear()
        dispatch({ type: 'rejected', error: cause })
        return
      } catch (storageError) {
        cause = normalizeFailure(storageError)
      }
    }
    dispatch({
      type: 'failed',
      error:
        record()?.stage === 'intent'
          ? new WorkshopWorkflowError('submission_unknown')
          : cause
    })
  }

  async function observeCancellation(
    saved: SavedWorkflow | undefined,
    signal: AbortSignal
  ) {
    if (saved?.stage !== 'run' || !saved.cancelRequested) return
    const observation = await options.api.cancel(saved.runId, signal)
    signal.throwIfAborted()
    dispatch({ type: 'observed', observation })
  }

  async function execute(inputs: FormValues, resume?: SavedWorkflow) {
    if (lifetime.signal.aborted) return
    operation?.abort()
    const current = new AbortController()
    operation = current
    const { signal } = current
    dispatch(resume ? { type: 'restore', record: resume } : { type: 'prepare' })
    try {
      await observeCancellation(resume, signal)
      await renderWorkflow(options.model.slug, inputs, {
        model: options.model,
        api: options.api,
        token: '',
        signal,
        uploadFile: options.uploadFile,
        runId: savedWorkflowRunId(resume),
        onPrepared: (attempt) => {
          signal.throwIfAborted()
          persist({
            type: 'restore',
            record: {
              version: 2,
              stage: 'intent',
              attempt,
              cancelRequested: record()?.cancelRequested ?? false
            }
          })
        },
        onAdmitted: async (run) => {
          signal.throwIfAborted()
          persist({ type: 'admitted', run })
          await observeCancellation(record(), signal)
        },
        onUpdate: (result) => {
          signal.throwIfAborted()
          dispatch({ type: 'observed', observation: result })
        }
      })
    } catch (error) {
      if (!signal.aborted) failure(error)
    } finally {
      if (operation === current) operation = undefined
    }
  }

  async function resume() {
    const saved = record() ?? options.storage.read()
    if (!saved) return
    if (saved.stage === 'intent') {
      dispatch({ type: 'restore', record: saved })
      dispatch({
        type: 'failed',
        error: new WorkshopWorkflowError('submission_unknown')
      })
      return
    }
    if (saved.definitionVersion !== options.model.workflow.definitionVersion) {
      dispatch({
        type: 'failed',
        error: new WorkshopWorkflowError('definition_changed')
      })
      return
    }
    await execute({}, saved)
  }

  async function cancel() {
    if (state.phase === 'preparing') {
      operation?.abort()
      dispatch({ type: 'detach' })
      return
    }
    if (!record()) return
    try {
      persist({ type: 'cancel_requested' })
      if (savedWorkflowRunId(record()) || !operation) await resume()
    } catch (error) {
      failure(error)
    }
  }

  async function retryDelivery() {
    const saved = record()
    if (saved?.stage !== 'run') return
    try {
      const result = await options.api.retryDelivery(
        saved.runId,
        lifetime.signal
      )
      lifetime.signal.throwIfAborted()
      if (savedWorkflowRunId(record()) !== saved.runId) return
      dispatch({ type: 'observed', observation: result })
      if (state.phase === 'active') await resume()
    } catch (error) {
      if (
        !lifetime.signal.aborted &&
        savedWorkflowRunId(record()) === saved.runId
      )
        failure(error)
    }
  }

  async function refreshOutput(outputId: string) {
    const saved = record()
    if (saved?.stage !== 'run') return
    try {
      const access = await options.api.access(
        saved.runId,
        outputId,
        lifetime.signal
      )
      lifetime.signal.throwIfAborted()
      if (
        !('record' in state) ||
        savedWorkflowRunId(state.record) !== saved.runId ||
        !state.observation
      )
        return
      dispatch({
        type: 'observed',
        observation: withOutputAccess(state.observation, outputId, access)
      })
    } catch (error) {
      if (
        !lifetime.signal.aborted &&
        savedWorkflowRunId(record()) === saved.runId
      )
        failure(error)
    }
  }

  return {
    resume,
    cancel,
    retryDelivery,
    refreshOutput,
    dismiss() {
      const dismissible =
        state.phase === 'settled' ||
        state.phase === 'failed' ||
        (state.phase === 'interrupted' && record()?.stage === 'intent')
      if (operation || !dismissible) return
      try {
        options.storage.clear()
        dispatch({ type: 'detach' })
      } catch (error) {
        failure(error)
      }
    },
    start(inputs: FormValues) {
      if (
        state.phase === 'active' ||
        state.phase === 'preparing' ||
        state.phase === 'interrupted'
      )
        return Promise.resolve()
      return execute(inputs)
    },
    dispose() {
      operation?.abort()
      dispatch({ type: 'detach' })
      lifetime.abort()
    }
  }
}
