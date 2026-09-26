import { describe, expect, it } from 'vitest'

import { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import type { RunFailure } from '../../config/workshop-run'
import type { WorkflowErrorCode } from '../../config/workshop-workflow-response'
import { failureLabelKey } from './failure-label'
import { panelSaysRefusal, workflowRunFailure } from './workflow-refusal'

// Every code the API can report and the refusal the panel stands up for it. The
// table is the specification: a code whose event the panel has no sentence for
// reads as undefined here, rather than as a sentence about something else.
const REFUSALS: readonly [
  WorkflowErrorCode | 'network' | 'response' | 'persistence',
  RunFailure | undefined
][] = [
  ['insufficient_credits', 'noCredits'],
  ['rate_limited', 'rateLimit'],
  ['network', 'network'],
  ['response', 'response'],
  ['execution_failed', 'provider'],
  // What is wrong with an input belongs beside the input, and the panel's own
  // words for a rejection it cannot pin to a field are about a model.
  ['invalid_request', undefined],
  ['invalid_input', undefined],
  ['payload_too_large', undefined],
  ['unsupported_media_type', undefined],
  // A session that expired and a form gone out of date the panel has no word
  // for at all.
  ['not_authenticated', undefined],
  ['workflow_not_found', undefined],
  ['definition_changed', undefined],
  ['definition_incompatible', undefined],
  // Codes the panel has a word for, about a different event: a workspace Cloud
  // denied is not a provider's content policy; an input upload that never
  // arrived is not a model being down; outputs that could not be fetched after
  // a run finished is not a connection that dropped mid-run; browser storage
  // the page could not write names its own fix, which the panel's sentence
  // does not.
  ['access_denied', undefined],
  ['media_unavailable', undefined],
  ['delivery_failed', undefined],
  ['submission_unknown', undefined],
  ['persistence', undefined],
  ['run_not_found', undefined]
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

// Whether the page keeps quiet beside the form follows from the same table: it
// speaks exactly where the panel does not, so the reader is never handed the
// same refusal twice, nor two different accounts of it.
describe('panelSaysRefusal', () => {
  it.for(REFUSALS)('leaves %s to the panel only as %s', ([code, refusal]) => {
    expect(
      panelSaysRefusal({
        phase: 'failed',
        error: new WorkshopWorkflowError(code)
      })
    ).toBe(refusal !== undefined)
  })

  it.for([{ phase: 'idle' }, { phase: 'preparing' }] as const)(
    'says nothing about a $phase page',
    (state) => {
      expect(panelSaysRefusal(state)).toBe(false)
    }
  )
})
