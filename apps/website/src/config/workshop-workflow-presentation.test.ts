import { describe, expect, it } from 'vitest'

import type { TranslationKey } from '../i18n/translations'
import { WorkshopWorkflowError } from './workshop-workflow-api'
import {
  workflowErrorKey,
  workflowNoticeKey
} from './workshop-workflow-presentation'
import type { WorkflowState } from './workshop-workflow-state'
import type { SavedWorkflow } from './workshop-workflow-storage'

const submitted: SavedWorkflow = {
  version: 2,
  cancelRequested: false,
  stage: 'run',
  runId: 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b',
  workflowId: 'workflows/remove-background',
  definitionVersion: '1'
}
const network = new WorkshopWorkflowError('network')
const expired = new WorkshopWorkflowError('not_authenticated')

describe('workflowNoticeKey', () => {
  it.for<{
    label: string
    state: WorkflowState
    error: WorkshopWorkflowError
    key: TranslationKey
  }>([
    {
      label: 'losing contact with a submitted run',
      state: { phase: 'interrupted', record: submitted, error: network },
      error: network,
      key: 'workshop.workflow.lostContact'
    },
    {
      label: 'an expired session while watching a submitted run',
      state: { phase: 'interrupted', record: submitted, error: expired },
      error: expired,
      key: 'workshop.workflow.signInAgain'
    },
    {
      label: 'a network failure before anything was submitted',
      state: { phase: 'failed', error: network },
      error: network,
      key: 'workshop.workflow.connectionLost'
    }
  ])('says $key for $label', ({ state, error, key }) => {
    expect(workflowNoticeKey(state, error)).toBe(key)
  })

  it.for<[WorkshopWorkflowError['code'], TranslationKey]>([
    ['invalid_request', 'workshop.error.validation'],
    ['invalid_input', 'workshop.error.validation'],
    ['payload_too_large', 'workshop.workflow.inputSize'],
    ['unsupported_media_type', 'workshop.form.badType'],
    ['not_authenticated', 'workshop.workflow.signInAgain'],
    ['access_denied', 'workshop.workflow.accessDenied'],
    ['workflow_not_found', 'workshop.workflow.definitionChanged'],
    ['definition_changed', 'workshop.workflow.definitionChanged'],
    ['definition_incompatible', 'workshop.workflow.definitionChanged'],
    ['run_not_found', 'workshop.workflow.runMissing'],
    ['insufficient_credits', 'workshop.error.noCredits'],
    ['rate_limited', 'workshop.error.rateLimit'],
    ['media_unavailable', 'workshop.workflow.mediaUnavailable'],
    ['execution_failed', 'workshop.workflow.failed'],
    ['delivery_failed', 'workshop.workflow.deliveryFailed'],
    ['persistence', 'workshop.workflow.storageFailed'],
    ['submission_unknown', 'workshop.workflow.submissionUnknown'],
    ['network', 'workshop.workflow.connectionLost'],
    ['response', 'workshop.workflow.connectionLost']
  ])('says %s as %s', ([code, key]) => {
    expect(workflowErrorKey(new WorkshopWorkflowError(code))).toBe(key)
  })
})
