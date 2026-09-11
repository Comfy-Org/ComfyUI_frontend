import type { ResultItem } from '@/schemas/apiSchema'
import type { NodeExecutionId } from '@/types/nodeIdentification'

export interface ExecutionOutputSelector {
  nodeId: NodeExecutionId
  nodeType: string
}

type ExecutionImages = Readonly<Partial<Record<string, ResultItem>>>

export type ExecutionJobState =
  | { phase: 'running'; images: ExecutionImages }
  | { phase: 'succeeded'; completedAt: number; images: ExecutionImages }
  | { phase: 'failed' }
  | { phase: 'cancelled' }

export type ExecutionJobEvent =
  | { type: 'output-received'; nodeId: string; image: ResultItem }
  | { type: 'succeeded'; completedAt: number }
  | { type: 'failed' }
  | { type: 'cancelled' }

export type ExecutionRejectionReason =
  | 'submission_rejected'
  | 'submission_failed'
  | 'workflow_changed'

export type ExecutionSubmissionState =
  | { phase: 'pending'; nodeTypes: Readonly<Record<string, string>> | null }
  | {
      phase: 'accepted'
      jobId: string
      nodeTypes: Readonly<Record<string, string>>
      job: ExecutionJobState
    }
  | { phase: 'rejected'; reason: ExecutionRejectionReason }
  | {
      phase: 'abandoned'
      reason: 'acceptance_timeout' | 'connection_timeout'
      previousPhase: 'pending' | 'accepted'
      jobId?: string
    }

export type ExecutionSubmissionEvent =
  | { type: 'prepared'; nodeTypes: Readonly<Record<string, string>> }
  | { type: 'accepted'; jobId: string; job: ExecutionJobState }
  | { type: 'job-updated'; jobId: string; job: ExecutionJobState }
  | { type: 'rejected'; reason: ExecutionRejectionReason }
  | {
      type: 'abandoned'
      reason: 'acceptance_timeout' | 'connection_timeout'
    }

export function transitionExecutionJob(
  state: ExecutionJobState,
  event: ExecutionJobEvent
): ExecutionJobState {
  if (state.phase === 'failed' || state.phase === 'cancelled') return state
  if (event.type === 'output-received') {
    const previous = state.images[event.nodeId]
    if (previous && previous.type !== 'temp') return state
    return {
      ...state,
      images: { ...state.images, [event.nodeId]: event.image }
    }
  }
  if (state.phase === 'succeeded') return state
  if (event.type === 'succeeded')
    return {
      phase: 'succeeded',
      completedAt: event.completedAt,
      images: state.images
    }
  return { phase: event.type }
}

export function transitionExecutionSubmission(
  state: ExecutionSubmissionState,
  event: ExecutionSubmissionEvent
): ExecutionSubmissionState {
  switch (event.type) {
    case 'prepared':
      return state.phase === 'pending' && state.nodeTypes === null
        ? { phase: 'pending', nodeTypes: event.nodeTypes }
        : state
    case 'accepted':
      return state.phase === 'pending' && state.nodeTypes !== null
        ? {
            phase: 'accepted',
            jobId: event.jobId,
            nodeTypes: state.nodeTypes,
            job: event.job
          }
        : state
    case 'job-updated':
      return state.phase === 'accepted' && state.jobId === event.jobId
        ? { ...state, job: event.job }
        : state
    case 'rejected':
      return state.phase === 'pending'
        ? { phase: 'rejected', reason: event.reason }
        : state
    case 'abandoned':
      if (
        state.phase !== 'pending' &&
        !(state.phase === 'accepted' && state.job.phase === 'running')
      )
        return state
      return {
        phase: 'abandoned',
        reason: event.reason,
        previousPhase: state.phase,
        ...(state.phase === 'accepted' && { jobId: state.jobId })
      }
  }
}

export function getExecutionImage(
  state: ExecutionSubmissionState,
  selector: ExecutionOutputSelector | null
): ResultItem | null {
  if (
    !selector ||
    state.phase !== 'accepted' ||
    state.nodeTypes[selector.nodeId] !== selector.nodeType ||
    (state.job.phase !== 'running' && state.job.phase !== 'succeeded')
  )
    return null
  return state.job.images[selector.nodeId] ?? null
}
