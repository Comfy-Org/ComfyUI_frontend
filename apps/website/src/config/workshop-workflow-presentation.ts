import type { TranslationKey } from '@/i18n/translations'
import type { WorkshopWorkflowError } from './workshop-workflow-api'
import type { WorkflowRunSummary } from './workshop-workflow-response'
import type { WorkflowState } from './workshop-workflow-state'

export function workflowStatusKey(run: WorkflowRunSummary): TranslationKey {
  if (run.state === 'cancelled') return 'workshop.workflow.cancelRequested'
  if (run.state === 'failed') return 'workshop.workflow.failed'
  if (run.state === 'succeeded')
    return run.outputState === 'pending'
      ? 'workshop.workflow.delivering'
      : 'workshop.output.complete'
  if (run.state === 'running') return 'workshop.run.running'
  return 'workshop.workflow.queued'
}

const WORKFLOW_ERROR_KEYS: Partial<
  Record<WorkshopWorkflowError['code'], TranslationKey>
> = {
  invalid_request: 'workshop.error.validation',
  invalid_input: 'workshop.error.validation',
  payload_too_large: 'workshop.workflow.inputSize',
  unsupported_media_type: 'workshop.form.badType',
  not_authenticated: 'workshop.workflow.signInAgain',
  access_denied: 'workshop.workflow.accessDenied',
  workflow_not_found: 'workshop.workflow.definitionChanged',
  definition_changed: 'workshop.workflow.definitionChanged',
  definition_incompatible: 'workshop.workflow.definitionChanged',
  run_not_found: 'workshop.workflow.runMissing',
  insufficient_credits: 'workshop.error.noCredits',
  rate_limited: 'workshop.error.rateLimit',
  media_unavailable: 'workshop.workflow.mediaUnavailable',
  media_download_failed: 'workshop.workflow.mediaUnavailable',
  media_upload_rejected: 'workshop.workflow.mediaUnavailable',
  media_upload_timeout: 'workshop.workflow.mediaUnavailable',
  media_upload_network: 'workshop.workflow.mediaUnavailable',
  service_unavailable: 'workshop.error.unavailable',
  execution_failed: 'workshop.workflow.failed',
  delivery_failed: 'workshop.workflow.deliveryFailed',
  persistence: 'workshop.workflow.storageFailed',
  submission_unknown: 'workshop.workflow.submissionUnknown'
}

export function workflowErrorKey(error: WorkshopWorkflowError): TranslationKey {
  return WORKFLOW_ERROR_KEYS[error.code] ?? 'workshop.workflow.connectionLost'
}

export function workflowNoticeKey(
  state: WorkflowState,
  error: WorkshopWorkflowError
): TranslationKey {
  const key = workflowErrorKey(error)
  return key === 'workshop.workflow.connectionLost' &&
    state.phase === 'interrupted' &&
    state.record.stage === 'run'
    ? 'workshop.workflow.lostContact'
    : key
}
