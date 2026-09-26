import { describe, expect, it } from 'vitest'

import type { RunFailure } from '../../config/workshop-run'
import type { WorkflowErrorCode } from '../../config/workshop-workflow-response'
import { failureLabelKey } from './failure-label'
import { workflowRunFailure } from './workflow-refusal'

// Every code the API can report and the refusal the panel stands up for it.
// The table is the specification: a code nobody decided about reads as
// undefined here rather than as a wrong sentence on the page.
const REFUSALS: readonly [
  WorkflowErrorCode | 'network' | 'response' | 'persistence',
  RunFailure | undefined
][] = [
  ['invalid_request', undefined],
  ['invalid_input', undefined],
  ['payload_too_large', undefined],
  ['unsupported_media_type', undefined],
  ['access_denied', 'policy'],
  ['insufficient_credits', 'noCredits'],
  ['rate_limited', 'rateLimit'],
  ['media_unavailable', 'unavailable'],
  ['execution_failed', 'provider'],
  ['delivery_failed', 'network'],
  ['submission_unknown', 'network'],
  ['network', 'network'],
  ['response', 'response'],
  ['persistence', 'client'],
  ['run_not_found', 'client'],
  ['not_authenticated', undefined],
  ['workflow_not_found', undefined],
  ['definition_changed', undefined],
  ['definition_incompatible', undefined]
]

describe('workflowRunFailure', () => {
  it.for(REFUSALS)('stands %s up as %s', ([code, refusal]) => {
    expect(workflowRunFailure({ code })).toBe(refusal)
  })

  // A code this page has not met yet is not given a sentence about something
  // else; the page keeps saying what it says today.
  it('claims nothing about a code it does not know', () => {
    expect(
      workflowRunFailure({ code: 'teapot' as WorkflowErrorCode })
    ).toBeUndefined()
  })

  it('only ever names a refusal the panel has words for', () => {
    for (const [, refusal] of REFUSALS)
      if (refusal) expect(failureLabelKey[refusal]).toBeTruthy()
  })
})
