import { createEventHook } from '@vueuse/core'
import { defineStore } from 'pinia'
import { onScopeDispose, readonly, shallowRef } from 'vue'
import type { DeepReadonly, ShallowRef } from 'vue'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resultItemType } from '@/schemas/apiSchema'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import { isImageResult } from '@/utils/resultItem'

import {
  transitionExecutionJob,
  transitionExecutionSubmission
} from './executionLifecycle'
import type {
  ExecutionJobEvent,
  ExecutionJobState,
  ExecutionRejectionReason,
  ExecutionSubmissionEvent,
  ExecutionSubmissionState
} from './executionLifecycle'

export const EXECUTION_ACCEPTANCE_TIMEOUT_MS = 15_000
export const EXECUTION_CONNECTION_TIMEOUT_MS = 20_000
const MAX_RETAINED_EXECUTIONS = 1000

export interface ExecutionHandle {
  readonly requestId: number
  readonly workflowInstanceId: string | undefined
  readonly state: DeepReadonly<ShallowRef<ExecutionSubmissionState>>
}

interface SubmissionEntry {
  handle: ExecutionHandle
  state: ShallowRef<ExecutionSubmissionState>
  acceptTimer: ReturnType<typeof setTimeout> | undefined
}

export const useExecutionLifecycleStore = defineStore(
  'executionLifecycle',
  () => {
    const submissions = new Map<number, SubmissionEntry>()
    const jobs = new Map<string, ExecutionJobState>()
    const submitted = createEventHook<ExecutionHandle>()
    let offlineTimer: ReturnType<typeof setTimeout> | undefined

    function dispatch(requestId: number, event: ExecutionSubmissionEvent) {
      const entry = submissions.get(requestId)
      if (!entry) return
      entry.state.value = transitionExecutionSubmission(
        entry.state.value,
        event
      )
      if (entry.state.value.phase !== 'pending') {
        clearTimeout(entry.acceptTimer)
        entry.acceptTimer = undefined
      }
    }

    function beginSubmission(requestId: number, workflowInstanceId?: string) {
      const existing = submissions.get(requestId)
      if (existing) return existing.handle
      const state = shallowRef<ExecutionSubmissionState>({
        phase: 'pending',
        nodeTypes: null
      })
      const handle: ExecutionHandle = {
        requestId,
        workflowInstanceId,
        state: readonly(state)
      }
      const acceptTimer = setTimeout(() => {
        dispatch(requestId, {
          type: 'abandoned',
          reason: 'acceptance_timeout'
        })
      }, EXECUTION_ACCEPTANCE_TIMEOUT_MS)
      submissions.set(requestId, { handle, state, acceptTimer })
      pruneSubmissions()
      void submitted.trigger(handle)
      return handle
    }

    function prepareSubmission(
      requestId: number,
      workflowInstanceId: string | undefined,
      prompt: ComfyApiWorkflow
    ) {
      const entry = submissions.get(requestId)
      if (!entry || entry.state.value.phase !== 'pending') return
      if (entry.handle.workflowInstanceId !== workflowInstanceId) {
        rejectSubmission(requestId, 'workflow_changed')
        return
      }
      dispatch(requestId, {
        type: 'prepared',
        nodeTypes: Object.fromEntries(
          Object.entries(prompt).map(([id, node]) => [id, node.class_type])
        )
      })
    }

    function acceptSubmission(requestId: number, jobId: string) {
      const job = jobs.get(jobId) ?? { phase: 'running', images: {} }
      dispatch(requestId, { type: 'accepted', jobId, job })
      jobs.set(jobId, job)
      pruneJobs()
    }

    function rejectSubmission(
      requestId: number,
      reason: ExecutionRejectionReason
    ) {
      dispatch(requestId, { type: 'rejected', reason })
    }

    function updateJob(jobId: string, event: ExecutionJobEvent) {
      const previous = jobs.get(jobId) ?? { phase: 'running', images: {} }
      const job = transitionExecutionJob(previous, event)
      jobs.set(jobId, job)
      for (const [requestId, entry] of submissions) {
        if (
          entry.state.value.phase === 'accepted' &&
          entry.state.value.jobId === jobId
        )
          dispatch(requestId, { type: 'job-updated', jobId, job })
      }
      pruneJobs()
    }

    function receiveOutput(detail: ExecutedWsMessage) {
      const images = parseNodeOutput(detail.node, detail.output).filter(
        isImageResult
      )
      const image = images.find(({ type }) => type !== 'temp') ?? images.at(0)
      if (!image) return
      const parsedType = resultItemType.safeParse(image.type)
      updateJob(detail.prompt_id, {
        type: 'output-received',
        nodeId: String(detail.display_node || detail.node),
        image: {
          filename: image.filename,
          subfolder: image.subfolder,
          type: parsedType.success ? parsedType.data : 'output'
        }
      })
    }

    function succeedJob(jobId: string, completedAt = Date.now()) {
      updateJob(jobId, { type: 'succeeded', completedAt })
    }

    function failJob(jobId: string) {
      updateJob(jobId, { type: 'failed' })
    }

    function cancelJob(jobId: string) {
      updateJob(jobId, { type: 'cancelled' })
    }

    function connectionLost() {
      if (offlineTimer) return
      offlineTimer = setTimeout(() => {
        offlineTimer = undefined
        for (const requestId of submissions.keys())
          dispatch(requestId, {
            type: 'abandoned',
            reason: 'connection_timeout'
          })
      }, EXECUTION_CONNECTION_TIMEOUT_MS)
    }

    function connectionRestored() {
      clearTimeout(offlineTimer)
      offlineTimer = undefined
    }

    function pruneSubmissions() {
      for (const [requestId, entry] of submissions) {
        if (submissions.size <= MAX_RETAINED_EXECUTIONS) break
        const state = entry.state.value
        if (
          state.phase === 'pending' ||
          (state.phase === 'accepted' && state.job.phase === 'running')
        )
          continue
        submissions.delete(requestId)
      }
    }

    function pruneJobs() {
      for (const jobId of jobs.keys()) {
        if (jobs.size <= MAX_RETAINED_EXECUTIONS) break
        const retained = [...submissions.values()].some(
          ({ state }) =>
            state.value.phase === 'accepted' && state.value.jobId === jobId
        )
        if (!retained) jobs.delete(jobId)
      }
    }

    function clear() {
      for (const [requestId, entry] of submissions) {
        rejectSubmission(requestId, 'submission_failed')
        if (entry.state.value.phase === 'accepted')
          cancelJob(entry.state.value.jobId)
        clearTimeout(entry.acceptTimer)
      }
      connectionRestored()
      submissions.clear()
      jobs.clear()
    }

    onScopeDispose(clear)

    return {
      beginSubmission,
      prepareSubmission,
      acceptSubmission,
      rejectSubmission,
      receiveOutput,
      succeedJob,
      failJob,
      cancelJob,
      connectionLost,
      connectionRestored,
      clear,
      onSubmitted: submitted.on
    }
  }
)
