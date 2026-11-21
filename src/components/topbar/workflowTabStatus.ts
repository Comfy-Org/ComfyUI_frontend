import type { WorkflowExecutionStatus } from '@/stores/executionStore'
import { WORKFLOW_STATUS_I18N_KEYS } from '@/stores/executionStore'

export type TabPrimaryStatus =
  | 'waiting'
  | 'failed'
  | 'busy'
  | 'unseen'
  | 'completed'

export type TabPopoverStatusKind =
  | 'waiting'
  | 'failed'
  | 'agent-working'
  | 'workflow-running'
  | 'agent-replied'
  | 'run-finished'
  | 'unsaved'

export interface TabStatusSignals {
  awaitingApproval: boolean
  agentWorking: boolean
  agentReplied: boolean
  workflowStatus?: WorkflowExecutionStatus
  unsaved?: boolean
}

export interface ResolvedTabPrimaryStatus {
  kind: TabPrimaryStatus
  labelKey: string
}

/** Translation keys for each status line shown in the inactive tab hover popover. */
export const TAB_POPOVER_STATUS_I18N_KEYS: Record<
  TabPopoverStatusKind,
  string
> = {
  waiting: 'sideToolbar.workflowTab.status.waitingForAnswer',
  failed: 'sideToolbar.workflowTab.status.runFailed',
  'agent-working': 'sideToolbar.workflowTab.status.agentWorking',
  'workflow-running': 'sideToolbar.workflowTab.status.workflowRunning',
  'agent-replied': 'sideToolbar.workflowTab.status.agentReplied',
  'run-finished': 'sideToolbar.workflowTab.status.runFinished',
  unsaved: 'sideToolbar.workflowTab.status.unsavedChanges'
}

/** Resolves the highest-priority status mark for a workflow tab's left status slot. */
export function resolvePrimaryTabStatus(
  signals: TabStatusSignals
): ResolvedTabPrimaryStatus | undefined {
  if (signals.awaitingApproval) {
    return { kind: 'waiting', labelKey: 'g.agentNeedsApproval' }
  }
  if (signals.workflowStatus === 'failed') {
    return { kind: 'failed', labelKey: WORKFLOW_STATUS_I18N_KEYS.failed }
  }
  const workflowRunning = signals.workflowStatus === 'running'
  if (signals.agentWorking && workflowRunning) {
    return { kind: 'busy', labelKey: 'g.agentWorkingAndWorkflowRunning' }
  }
  if (signals.agentWorking) {
    return { kind: 'busy', labelKey: 'g.agentWorking' }
  }
  if (workflowRunning) {
    return { kind: 'busy', labelKey: WORKFLOW_STATUS_I18N_KEYS.running }
  }
  if (signals.agentReplied) {
    return { kind: 'unseen', labelKey: 'g.agentFinishedUnseen' }
  }
  if (signals.workflowStatus === 'completed') {
    return { kind: 'completed', labelKey: WORKFLOW_STATUS_I18N_KEYS.completed }
  }
  return undefined
}

/** Lists every applicable status in priority order for an inactive tab's hover preview. */
export function resolveTabPopoverStatuses(
  signals: TabStatusSignals
): TabPopoverStatusKind[] {
  const statuses: TabPopoverStatusKind[] = []
  if (signals.awaitingApproval) {
    statuses.push('waiting')
  }
  if (signals.workflowStatus === 'failed') {
    statuses.push('failed')
  }
  if (!signals.awaitingApproval && signals.agentWorking) {
    statuses.push('agent-working')
  }
  if (signals.workflowStatus === 'running') {
    statuses.push('workflow-running')
  }
  if (signals.agentReplied) {
    statuses.push('agent-replied')
  }
  if (signals.workflowStatus === 'completed') {
    statuses.push('run-finished')
  }
  if (signals.unsaved) {
    statuses.push('unsaved')
  }
  return statuses
}
