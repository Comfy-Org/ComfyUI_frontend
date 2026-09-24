import type { WorkshopWorkflowError } from './workshop-workflow-api'
import type {
  WorkflowRun,
  WorkflowRunSummary
} from './workshop-workflow-response'
import { workflowSettled } from './workshop-workflow-response'
import type { SavedWorkflow } from './workshop-workflow-storage'
import {
  savedWorkflowId,
  savedWorkflowRunId
} from './workshop-workflow-storage'

export type WorkflowState =
  | { readonly phase: 'idle' | 'preparing' }
  | { readonly phase: 'failed'; readonly error: WorkshopWorkflowError }
  | {
      readonly phase: 'active'
      readonly record: SavedWorkflow
      readonly observation?: WorkflowRun
    }
  | {
      readonly phase: 'interrupted'
      readonly record: SavedWorkflow
      readonly observation?: WorkflowRun
      readonly error: WorkshopWorkflowError
    }
  | {
      readonly phase: 'settled'
      readonly record: SavedWorkflow
      readonly observation: WorkflowRun
    }

export type WorkflowEvent =
  | { readonly type: 'prepare' | 'detach' }
  | { readonly type: 'restore'; readonly record: SavedWorkflow }
  | { readonly type: 'admitted'; readonly run: WorkflowRunSummary }
  | { readonly type: 'observed'; readonly observation: WorkflowRun }
  | { readonly type: 'cancel_requested' }
  | {
      readonly type: 'failed' | 'rejected'
      readonly error: WorkshopWorkflowError
    }

function observedWorkflowState(
  state: WorkflowState,
  observation: WorkflowRun
): WorkflowState {
  if (
    !('record' in state) ||
    observation.run.id !== savedWorkflowRunId(state.record) ||
    observation.run.workflowId !== savedWorkflowId(state.record)
  )
    return state
  if (
    state.observation &&
    Date.parse(state.observation.run.updatedAt) >
      Date.parse(observation.run.updatedAt)
  )
    return state
  return {
    phase: workflowSettled(observation) ? 'settled' : 'active',
    record: state.record,
    observation
  }
}

export function transitionWorkflow(
  state: WorkflowState,
  event: WorkflowEvent
): WorkflowState {
  switch (event.type) {
    case 'prepare':
      return { phase: 'preparing' }
    case 'detach':
      return { phase: 'idle' }
    case 'restore':
      return { phase: 'active', record: event.record }
    case 'rejected':
      return { phase: 'failed', error: event.error }
    case 'failed':
      return 'record' in state
        ? { ...state, phase: 'interrupted', error: event.error }
        : { phase: 'failed', error: event.error }
    case 'admitted': {
      if (
        !('record' in state) ||
        state.record.stage !== 'intent' ||
        event.run.workflowId !== savedWorkflowId(state.record)
      )
        return state
      return {
        ...state,
        record: {
          version: 1,
          stage: 'run',
          runId: event.run.id,
          workflowId: event.run.workflowId,
          definitionVersion: event.run.definitionVersion,
          appInputs: state.record.attempt.request.appInputs,
          cancelRequested: state.record.cancelRequested
        }
      }
    }
    case 'cancel_requested':
      return 'record' in state
        ? { ...state, record: { ...state.record, cancelRequested: true } }
        : state
    case 'observed':
      return observedWorkflowState(state, event.observation)
  }
}
