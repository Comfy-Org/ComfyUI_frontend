import type { TranslationKey } from '../i18n/translations'
import type { WorkshopWorkflowError } from './workshop-workflow-api'
import type { WorkflowRunSummary } from './workshop-workflow-response'

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
    case 'media_unavailable':
      return 'workshop.workflow.mediaUnavailable'
    case 'execution_failed':
      return 'workshop.workflow.failed'
    case 'delivery_failed':
      return 'workshop.workflow.deliveryFailed'
    case 'persistence':
      return 'workshop.workflow.storageFailed'
    case 'submission_unknown':
      return 'workshop.workflow.submissionUnknown'
    default:
      return 'workshop.workflow.connectionLost'
  }
}
