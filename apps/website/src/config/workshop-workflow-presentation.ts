import type { TranslationKey } from '../i18n/translations'
import type { WorkshopWorkflowError } from './workshop-workflow-api'
import type {
  WorkflowRun,
  WorkflowRunSummary
} from './workshop-workflow-response'

export function workflowStatusKey(
  run: WorkflowRunSummary,
  runtime?: WorkflowRun['runtime']
): TranslationKey {
  if (run.state === 'cancelled') return 'workshop.output.cancelled'
  if (run.state === 'failed') return 'workshop.workflow.failed'
  if (run.state === 'succeeded')
    return run.outputState === 'pending'
      ? 'workshop.workflow.delivering'
      : 'workshop.output.complete'
  if (run.cancelRequestedAt) return 'workshop.workflow.cancelling'
  if (run.state === 'running') return 'workshop.run.running'
  if (runtime?.state === 'starting') return 'workshop.workflow.starting'
  if (run.state === 'queued') return 'workshop.workflow.queued'
  return run.state === 'submission_unknown'
    ? 'workshop.workflow.confirming'
    : 'workshop.workflow.submitting'
}

export function workflowErrorKey(error: WorkshopWorkflowError): TranslationKey {
  switch (error.code) {
    case 'invalid_request':
    case 'invalid_input':
      return 'workshop.error.validation'
    case 'payload_too_large':
      return 'workshop.workflow.inputSize'
    case 'unsupported_media_type':
      return 'workshop.form.badType'
    case 'not_authenticated':
      return 'workshop.workflow.signInAgain'
    case 'access_denied':
      return 'workshop.workflow.accessDenied'
    case 'workflow_not_found':
    case 'definition_changed':
    case 'definition_incompatible':
      return 'workshop.workflow.definitionChanged'
    case 'run_not_found':
      return 'workshop.workflow.runMissing'
    case 'plan_required':
      return 'workshop.workflow.planRequired'
    case 'insufficient_credits':
      return 'workshop.error.noCredits'
    case 'rate_limited':
      return 'workshop.error.rateLimit'
    case 'admission_disabled':
      return 'workshop.workflow.paused'
    case 'upload_pending':
    case 'media_unavailable':
      return 'workshop.workflow.mediaUnavailable'
    case 'execution_failed':
      return 'workshop.workflow.failed'
    case 'delivery_failed':
      return 'workshop.workflow.deliveryFailed'
    case 'persistence':
      return 'workshop.workflow.storageFailed'
    default:
      return 'workshop.workflow.connectionLost'
  }
}
