import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ResultItem } from '@/schemas/apiSchema'
import type { NodeExecutionId } from '@/types/nodeIdentification'

export type FirstRunCorrelationState = { output: ResultItem | null } & (
  | { phase: 'idle' }
  | {
      phase: 'pending'
      outputNodeId: NodeExecutionId | null
      workflow: ComfyWorkflow
      previousJobIds: ReadonlySet<string>
      pendingOutputs: ReadonlyMap<string, ResultItem>
      pendingCompletions: ReadonlyMap<string, number>
    }
  | {
      phase: 'accepted'
      workflow: ComfyWorkflow
      jobId: string
      outputNodeId: NodeExecutionId | null
    }
  | {
      phase: 'succeeded'
      jobId: string
      completedAt: number
      outputNodeId: NodeExecutionId | null
    }
)

export type FirstRunCorrelationEvent =
  | { type: 'reset' }
  | { type: 'released' }
  | {
      type: 'submitted'
      outputNodeId: NodeExecutionId | null
      workflow: ComfyWorkflow
      previousJobIds: ReadonlySet<string>
    }
  | { type: 'accepted'; jobId: string }
  | { type: 'succeeded'; jobId: string; completedAt: number }
  | {
      type: 'output-received'
      jobId: string
      nodeId: string
      output: ResultItem
    }

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
        outputNodeId: event.outputNodeId,
        output: state.output,
        workflow: event.workflow,
        previousJobIds: event.previousJobIds,
        pendingOutputs: new Map(),
        pendingCompletions: new Map()
      }
    case 'accepted': {
      if (state.phase !== 'pending' || state.previousJobIds.has(event.jobId))
        return state
      const output =
        state.output ?? state.pendingOutputs.get(event.jobId) ?? null
      const completedAt = state.pendingCompletions.get(event.jobId)
      if (completedAt !== undefined)
        return {
          phase: 'succeeded',
          jobId: event.jobId,
          completedAt,
          output,
          outputNodeId: state.outputNodeId
        }
      return {
        phase: 'accepted',
        outputNodeId: state.outputNodeId,
        workflow: state.workflow,
        jobId: event.jobId,
        output
      }
    }
    case 'succeeded':
      if (state.phase === 'accepted')
        return state.jobId === event.jobId
          ? {
              phase: 'succeeded',
              outputNodeId: state.outputNodeId,
              jobId: event.jobId,
              completedAt: event.completedAt,
              output: state.output
            }
          : state
      if (
        state.phase !== 'pending' ||
        state.previousJobIds.has(event.jobId) ||
        state.pendingCompletions.has(event.jobId)
      )
        return state
      return {
        ...state,
        pendingCompletions: new Map(state.pendingCompletions).set(
          event.jobId,
          event.completedAt
        )
      }
    case 'output-received': {
      if (
        state.phase === 'idle' ||
        event.nodeId !== state.outputNodeId ||
        (state.output && state.output.type !== 'temp')
      )
        return state
      if (state.phase === 'accepted' || state.phase === 'succeeded')
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
