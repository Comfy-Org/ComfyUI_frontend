import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { RunState } from '../../composables/useWorkflowRun'
import WorkflowRunResult from './WorkflowRunResult.vue'

const mount = (state: RunState, memberWorkspace?: string) =>
  render(WorkflowRunResult, {
    props: { state, outputs: [], memberWorkspace }
  })

const refused = (reason: string): RunState =>
  ({ phase: 'error', reason, retrySafe: true }) as RunState

describe('WorkflowRunResult', () => {
  // A named refusal exists so that the one way out can differ. Each of these
  // asks the reader for something different, or for nothing.
  it.for([
    { reason: 'noCredits', offer: 'workflow-run-credits' },
    { reason: 'signedOut', offer: 'workflow-run-signin-again' },
    { reason: 'rateLimit', offer: 'workflow-run-retry' },
    { reason: 'concurrency', offer: 'workflow-run-retry' },
    { reason: 'timeout', offer: 'workflow-run-retry' },
    { reason: 'unavailable', offer: 'workflow-run-retry' },
    { reason: 'provider', offer: 'workflow-run-retry' },
    { reason: 'upload', offer: 'workflow-run-retry' }
  ])(
    'offers $offer when the run is refused for $reason',
    ({ reason, offer }) => {
      mount(refused(reason))

      expect(screen.getByTestId('workflow-run-error')).toBeTruthy()
      expect(screen.getByTestId(offer)).toBeTruthy()
    }
  )

  // Pressing anything again would be refused the same way, so the panel says
  // what happened and stops there.
  it.for(['policy', 'validation', 'client'])(
    'offers nothing to press when %s would refuse it again',
    (reason) => {
      mount(refused(reason))

      expect(
        within(screen.getByTestId('workflow-run-error')).queryByRole('button')
      ).toBeNull()
    }
  )

  it('names each refusal, so support is told which one it was', () => {
    mount(refused('rateLimit'))

    expect(
      screen.getByTestId('workflow-run-error').getAttribute('data-reason')
    ).toBe('rateLimit')
  })

  // Buying credits for a workspace the reader only belongs to would not help:
  // the owner does that. What they can do is run it on their own.
  it('names the workspace and offers the reader their own one', () => {
    mount(refused('noCredits'), 'Comfy Design')

    expect(screen.getByTestId('workflow-run-error').textContent).toContain(
      'Comfy Design'
    )
    expect(screen.getByTestId('workflow-run-personal')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-credits')).toBeNull()
  })

  // The page's own refusals name the answer that was wrong, which the general
  // sentence for its reason cannot.
  it('prefers what the page itself has to say', () => {
    mount({
      phase: 'error',
      reason: 'validation',
      message: 'Choose an input smaller than 100 MB.',
      retrySafe: true
    })

    expect(screen.getByTestId('workflow-run-error').textContent).toContain(
      'Choose an input smaller than 100 MB.'
    )
  })

  // A run that may still be out there is worth going back to; a second one
  // would be a second charge.
  it('offers the way back to a run rather than another one', () => {
    mount({
      phase: 'error',
      reason: 'network',
      jobId: '11111111-2222-3333-4444-555555555555',
      retrySafe: false
    })

    expect(screen.getByTestId('workflow-run-resume')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-retry')).toBeNull()
  })

  // Stopping a run on purpose is not a failure and is not dressed as one.
  it('tells a cancelled run apart from a failed one', async () => {
    const { emitted } = mount({ phase: 'cancelled' })

    expect(screen.queryByTestId('workflow-run-error')).toBeNull()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run it again' }))

    expect(emitted('retry')).toHaveLength(1)
  })
})
