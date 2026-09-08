import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ResultItem } from '@/schemas/apiSchema'

export type FirstRunCorrelationState = { output: ResultItem | null } & (
  | { phase: 'idle' }
  | {
      phase: 'pending'
      workflow: ComfyWorkflow
      previousJobIds: ReadonlySet<string>
      pendingOutputs: ReadonlyMap<string, ResultItem>
    }
  | { phase: 'accepted'; workflow: ComfyWorkflow; jobId: string }
)

export type FirstRunCorrelationEvent =
  | { type: 'reset' }
  | { type: 'released' }
  | {
      type: 'submitted'
      workflow: ComfyWorkflow
      previousJobIds: ReadonlySet<string>
    }
  | { type: 'accepted'; jobId: string }
  | { type: 'output-received'; jobId: string; output: ResultItem }

export function transitionFirstRunCorrelation(
  state: FirstRunCorrelationState,
  event: FirstRunCorrelationEvent
): FirstRunCorrelationState {
  switch (event.type) {
    case 'reset':
      return { phase: 'idle', output: null }
    case 'released':
      return { phase: 'idle', output: state.output }
    case 'submitted':
      return {
        phase: 'pending',
        output: state.output,
        workflow: event.workflow,
        previousJobIds: event.previousJobIds,
        pendingOutputs: new Map()
      }
    case 'accepted':
      if (state.phase !== 'pending' || state.previousJobIds.has(event.jobId))
        return state
      return {
        phase: 'accepted',
        workflow: state.workflow,
        jobId: event.jobId,
        output: state.output ?? state.pendingOutputs.get(event.jobId) ?? null
      }
    case 'output-received': {
      if (
        state.phase === 'idle' ||
        (state.output && state.output.type !== 'temp')
      )
        return state
      if (state.phase === 'accepted')
        return state.jobId === event.jobId
          ? { ...state, output: event.output }
          : state
      if (state.previousJobIds.has(event.jobId)) return state
      const buffered = state.pendingOutputs.get(event.jobId)
      if (buffered && buffered.type !== 'temp') return state
      return {
        ...state,
        pendingOutputs: new Map(state.pendingOutputs).set(
          event.jobId,
          event.output
        )
      }
    }
  }
}
