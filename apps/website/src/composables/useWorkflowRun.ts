import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { WorkflowField } from '../config/workflow-fields'
import { templateAsset } from '../config/workflow-fields'
import type { WorkflowGraph, WorkflowJob } from '../config/workflow-execution'
import {
  WorkflowHttpError,
  bindWorkflowInputs,
  createWorkflowClient,
  workflowFinished
} from '../config/workflow-execution'
import { WORKSHOP_CLOUD_BASE_URL } from '../config/workshop-env'
import { useWorkshopSession } from '../config/workshop-session-state'
import { refreshWorkshopCredits } from '../config/workshop-credits'

type RunState =
  | { phase: 'idle' }
  | { phase: 'uploading' | 'submitting' | 'reconnecting' }
  | { phase: 'tracking'; job: WorkflowJob }
  | { phase: 'finished'; job: WorkflowJob }
  | { phase: 'error'; message: string; jobId?: string; retrySafe: boolean }

/**
 * One run of one workflow against Cloud: the fields the reader fills, the
 * upload of whatever they chose, the job, and the wait for it. It takes the
 * bindings rather than a catalogue entry, so the page that owns the workflow
 * keeps owning its name, its shelf and everything else about it.
 */
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
  const files = new Map<string, File>()
  const previews = ref<Record<string, string>>({})
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
      throw new Error(
        'Your account or workspace changed. Start a new run in the selected workspace.'
      )
    return fresh.session.token
  })

  function releaseOutputs() {
    outputs.value.forEach((output) => URL.revokeObjectURL(output.url))
    outputs.value = []
  }
  function selectFile(key: string, file: File) {
    if (previews.value[key]) URL.revokeObjectURL(previews.value[key])
    files.set(key, file)
    previews.value[key] = URL.createObjectURL(file)
  }
  function inputPreview(key: string) {
    return (
      previews.value[key] ??
      (values.value[key]
        ? templateAsset('input', String(values.value[key]))
        : undefined)
    )
  }
  async function poll(id: string, signal: AbortSignal) {
    while (!signal.aborted) {
      const job = await client.read(
        `/api/jobs/${encodeURIComponent(id)}`,
        signal
      )
      signal.throwIfAborted()
      state.value = { phase: 'tracking', job }
      if (workflowFinished(job)) {
        if (job.status === 'completed') {
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
        state.value = { phase: 'finished', job }
        void refreshWorkshopCredits({ force: true })
        return
      }
      await new Promise<void>((resolve, reject) => {
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
    }
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
    state.value = { phase: 'uploading' }
    try {
      for (const field of fields) {
        const key = `${field.node}.${field.input}`
        if (
          ['image', 'video', 'audio'].includes(field.kind) &&
          !files.has(key) &&
          !values.value[key]
        )
          throw new Error(`Upload ${field.label.toLowerCase()} before running.`)
      }
      const bindings = []
      for (const field of fields) {
        const key = `${field.node}.${field.input}`
        let value: unknown =
          field.kind === 'number'
            ? Number(values.value[key])
            : values.value[key]
        if (['image', 'video', 'audio'].includes(field.kind)) {
          let file = files.get(key)
          if (!file) {
            const response = await fetch(
              templateAsset('input', String(values.value[key])),
              { signal }
            )
            if (!response.ok)
              throw new Error(
                'The example input could not load. Upload your own file and try again.'
              )
            const blob = await response.blob()
            file = new File([blob], String(values.value[key]), {
              type: blob.type
            })
          }
          if (file.size > 100 * 1024 * 1024)
            throw new Error('Choose an input smaller than 100 MB.')
          value = await client.upload(file, signal)
        }
        bindings.push({ node: field.node, input: field.input, value })
      }
      state.value = { phase: 'submitting' }
      jobId = await client.submit(bindWorkflowInputs(graph, bindings), signal)
      await poll(jobId, signal)
    } catch (error) {
      if (!signal.aborted)
        state.value = {
          phase: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Could not reach Cloud. Check your Cloud job history before submitting again.',
          jobId,
          retrySafe:
            !jobId &&
            (state.value.phase !== 'submitting' ||
              (error instanceof WorkflowHttpError && error.retrySafe))
        }
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
      if (!signal.aborted)
        state.value = {
          phase: 'error',
          message: String(error),
          jobId,
          retrySafe: false
        }
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
      state.value = {
        phase: 'error',
        message: `Cancellation could not be confirmed. ${String(error)}`,
        jobId: job.id,
        retrySafe: false
      }
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
    Object.values(previews.value).forEach((url) => URL.revokeObjectURL(url))
  })
  return {
    state,
    values,
    outputs,
    busy,
    session,
    settled,
    selectFile,
    inputPreview,
    run,
    resume,
    cancel
  }
}
