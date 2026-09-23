import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { WorkflowField } from '../config/workflow-fields'
import { templateAsset } from '../config/workflow-fields'
import type { FileValue } from '../config/workshop-playground'
import type { WorkflowGraph, WorkflowJob } from '../config/workflow-execution'
import {
  WorkflowHttpError,
  bindWorkflowInputs,
  createWorkflowClient,
  workflowFinished
} from '../config/workflow-execution'
import type { WorkflowFailure } from '../lib/hub/run-failure'
import { WORKSHOP_CLOUD_BASE_URL } from '../config/workshop-env'
import { useWorkshopSession } from '../config/workshop-session-state'
import { refreshWorkshopCredits } from '../config/workshop-credits'

/** Where one run has got to, and what the page can say about it. */
export type RunState =
  | { phase: 'idle' }
  | { phase: 'uploading' | 'submitting' | 'reconnecting' }
  | { phase: 'tracking'; job: WorkflowJob }
  | { phase: 'finished'; job: WorkflowJob }
  | { phase: 'cancelled' }
  | {
      phase: 'error'
      reason: WorkflowFailure
      /**
       * The page's own words, where it stopped the run itself and can say
       * something more useful than the reason's general sentence. Cloud's
       * refusals carry none: the reason names them better, and in both
       * languages.
       */
      message?: string
      jobId?: string
      retrySafe: boolean
    }

/**
 * How a job that has stopped is told. Cancelled was the reader's own doing
 * and is not a failure; one that came back failed is over rather than still
 * out there, so it carries no job to go back to.
 */
function settledState(job: WorkflowJob): RunState {
  if (job.status === 'cancelled') return { phase: 'cancelled' }
  if (job.status === 'failed')
    return { phase: 'error', reason: 'provider', retrySafe: true }
  return { phase: 'finished', job }
}

/** Something this page stopped over, named the way a refusal from Cloud is. */
class RunProblem extends Error {
  constructor(
    readonly reason: WorkflowFailure,
    message: string
  ) {
    super(message)
  }
}

/**
 * One run of one workflow against Cloud: the fields the reader fills, the
 * upload of whatever they chose, the job, and the wait for it. It takes the
 * bindings rather than a catalogue entry, so the page that owns the workflow
 * keeps owning its name, its shelf and everything else about it.
 */
const carriesAFile = (field: WorkflowField) =>
  ['image', 'video', 'audio'].includes(field.kind)

/** Which named refusal this was, whoever raised it. */
function reasonFor(error: unknown): WorkflowFailure {
  if (error instanceof WorkflowHttpError || error instanceof RunProblem)
    return error.reason
  if (error instanceof DOMException && error.name === 'TimeoutError')
    return 'timeout'
  return error instanceof TypeError ? 'network' : 'client'
}

/**
 * What went wrong, and whether pressing Run again is safe. It is safe only
 * when the work never left this page: once a job may exist, starting a second
 * one spends a second run to find out.
 */
function failed(error: unknown, jobId: string | undefined, sent: boolean) {
  const stillHere =
    !sent || (error instanceof WorkflowHttpError && error.retrySafe)
  return {
    phase: 'error',
    reason: reasonFor(error),
    message: error instanceof RunProblem ? error.message : undefined,
    jobId,
    retrySafe: !jobId && stillHere
  } as const
}

export function useWorkflowRun(
  fields: readonly WorkflowField[],
  graph: WorkflowGraph
) {
  const { session, settled, ensureFresh } = useWorkshopSession()
  const identity = computed(() =>
    session.value ? `${session.value.uid}:${session.value.workspace.id}` : ''
  )
  const state = shallowRef<RunState>({ phase: 'idle' })
  const values = ref<Record<string, string | number>>(
    Object.fromEntries(
      fields.map((field) => [
        `${field.node}.${field.input}`,
        String(graph[field.node].inputs[field.input])
      ])
    )
  )
  // Every file field starts holding the example the template ships with, so
  // the form is complete the moment it opens and Run means something.
  const files = ref<Record<string, FileValue | undefined>>(
    Object.fromEntries(
      fields.filter(carriesAFile).map((field) => {
        const name = String(graph[field.node].inputs[field.input])
        const url = templateAsset('input', name)
        return [
          `${field.node}.${field.input}`,
          {
            name,
            size: 0,
            type: `${field.kind}/*`,
            previewUrl: url,
            sourceUrl: url
          }
        ]
      })
    )
  )
  const outputs = ref<{ url: string; name: string; mime: string }[]>([])
  const busy = computed(() =>
    ['uploading', 'submitting', 'tracking', 'reconnecting'].includes(
      state.value.phase
    )
  )
  let controller: AbortController | undefined
  let owner = ''
  const client = createWorkflowClient(WORKSHOP_CLOUD_BASE_URL, async () => {
    const fresh = await ensureFresh()
    if (
      fresh?.status !== 'ok' ||
      `${fresh.session.uid}:${fresh.session.workspace.id}` !== owner
    )
      throw new RunProblem(
        'signedOut',
        'Your account or workspace changed. Start a new run in the selected workspace.'
      )
    return fresh.session.token
  })

  function releaseOutputs() {
    outputs.value.forEach((output) => URL.revokeObjectURL(output.url))
    outputs.value = []
  }
  /** Everything the job made, fetched and held until this run is replaced. */
  async function collect(id: string, signal: AbortSignal) {
    const result = await client.outputs(id, signal)
    for (const asset of result.assets) {
      const blob = await client.outputFile(asset.id, signal)
      signal.throwIfAborted()
      outputs.value.push({
        url: URL.createObjectURL(blob),
        name: asset.name,
        mime: asset.mime_type ?? blob.type
      })
    }
  }

  /** The wait between one look at the job and the next. */
  const pause = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort)
        resolve()
      }, 2500)
      function abort() {
        clearTimeout(timer)
        reject(signal.reason)
      }
      signal.addEventListener('abort', abort, { once: true })
    })

  async function poll(id: string, signal: AbortSignal) {
    while (!signal.aborted) {
      const job = await client.read(
        `/api/jobs/${encodeURIComponent(id)}`,
        signal
      )
      signal.throwIfAborted()
      state.value = { phase: 'tracking', job }
      if (workflowFinished(job)) {
        if (job.status === 'completed') await collect(id, signal)
        state.value = settledState(job)
        void refreshWorkshopCredits({ force: true })
        return
      }
      await pause(signal)
    }
  }
  /** An answer that has to travel as a file, uploaded and named. */
  async function uploadAnswer(key: string, signal: AbortSignal) {
    const answer = files.value[key]
    let file = answer?.file
    if (!file && answer?.sourceUrl) {
      const response = await fetch(answer.sourceUrl, { signal })
      if (!response.ok)
        throw new RunProblem(
          'upload',
          'The example input could not load. Upload your own file and try again.'
        )
      const blob = await response.blob()
      file = new File([blob], answer.name, { type: blob.type })
    }
    if (!file)
      throw new RunProblem('validation', 'Choose a file before running.')
    if (file.size > 100 * 1024 * 1024)
      throw new RunProblem('validation', 'Choose an input smaller than 100 MB.')
    return client.upload(file, signal)
  }

  /** One answer, in the form the graph takes it. */
  async function bindingFor(field: WorkflowField, signal: AbortSignal) {
    const key = `${field.node}.${field.input}`
    const value = carriesAFile(field)
      ? await uploadAnswer(key, signal)
      : field.kind === 'number'
        ? Number(values.value[key])
        : values.value[key]
    return { node: field.node, input: field.input, value }
  }

  /** What the reader has not answered yet, named the way they were asked. */
  function unanswered() {
    return fields.find(
      (field) =>
        carriesAFile(field) && !files.value[`${field.node}.${field.input}`]
    )
  }

  async function run() {
    if (
      busy.value ||
      !session.value ||
      (state.value.phase === 'error' && !state.value.retrySafe)
    )
      return
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    owner = identity.value
    releaseOutputs()
    let jobId: string | undefined
    let sent = false
    state.value = { phase: 'uploading' }
    try {
      const missing = unanswered()
      if (missing)
        throw new RunProblem(
          'validation',
          `Upload ${missing.label.toLowerCase()} before running.`
        )
      const bindings = []
      for (const field of fields) bindings.push(await bindingFor(field, signal))
      state.value = { phase: 'submitting' }
      sent = true
      jobId = await client.submit(bindWorkflowInputs(graph, bindings), signal)
      await poll(jobId, signal)
    } catch (error) {
      if (!signal.aborted) state.value = failed(error, jobId, sent)
    }
  }
  async function resume() {
    if (state.value.phase !== 'error' || !state.value.jobId) return
    const jobId = state.value.jobId
    state.value = { phase: 'reconnecting' }
    releaseOutputs()
    controller = new AbortController()
    const { signal } = controller
    try {
      await poll(jobId, signal)
    } catch (error) {
      if (!signal.aborted) state.value = failed(error, jobId, true)
    }
  }
  async function cancel() {
    if (state.value.phase !== 'tracking' || !controller) return
    const job = state.value.job
    try {
      await client.cancel(
        `/api/jobs/${encodeURIComponent(job.id)}/cancel`,
        controller.signal
      )
    } catch (error) {
      controller.abort()
      state.value = failed(
        new RunProblem('client', 'Cancellation could not be confirmed.'),
        job.id,
        true
      )
    }
  }
  watch(identity, (next, previous) => {
    if (next === previous) return
    controller?.abort()
    releaseOutputs()
    state.value = { phase: 'idle' }
  })
  useEventListener('beforeunload', (event) => {
    if (busy.value) event.preventDefault()
  })
  onScopeDispose(() => {
    controller?.abort()
    releaseOutputs()
  })
  return {
    state,
    values,
    outputs,
    busy,
    session,
    settled,
    files,
    run,
    resume,
    cancel
  }
}
