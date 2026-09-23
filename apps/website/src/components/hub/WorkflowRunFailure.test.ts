import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { WorkflowFailure } from '../../lib/hub/run-failure'
import WorkflowRunFailure from './WorkflowRunFailure.vue'

const mount = (
  reason: WorkflowFailure,
  extra: { memberWorkspace?: string; jobId?: string; message?: string } = {}
) => render(WorkflowRunFailure, { props: { reason, ...extra } })

describe('WorkflowRunFailure', () => {
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
  ] as const)(
    'offers $offer when a run is refused for $reason',
    ({ reason, offer }) => {
      mount(reason)

      expect(screen.getByTestId(offer)).toBeTruthy()
    }
  )

  // Pressing anything again would be refused the same way, so it says what
  // happened and stops there.
  it.for(['policy', 'validation', 'client'] as const)(
    'offers nothing to press when %s would refuse it again',
    (reason) => {
      mount(reason)

      expect(
        within(screen.getByTestId('workflow-run-error')).queryByRole('button')
      ).toBeNull()
    }
  )

  it('names each refusal, so support is told which one it was', () => {
    mount('rateLimit')

    expect(
      screen.getByTestId('workflow-run-error').getAttribute('data-reason')
    ).toBe('rateLimit')
  })

  // Buying credits for a workspace the reader only belongs to would not help:
  // the owner does that. What they can do is run it on their own.
  it('names the workspace and offers the reader their own one', () => {
    mount('noCredits', { memberWorkspace: 'Comfy Design' })

    expect(screen.getByTestId('workflow-run-error').textContent).toContain(
      'Comfy Design'
    )
    expect(screen.getByTestId('workflow-run-personal')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-credits')).toBeNull()
  })

  // The page's own refusals name the answer that was wrong, which the general
  // sentence for its reason cannot.
  it('prefers what the page itself has to say', () => {
    mount('validation', { message: 'Choose an input smaller than 100 MB.' })

    expect(screen.getByTestId('workflow-run-error').textContent).toContain(
      'Choose an input smaller than 100 MB.'
    )
  })

  // A run that may still be out there outranks every other offer: a second
  // one would be a second charge to find out what the first did.
  it('offers the way back to a run rather than another one', async () => {
    const { emitted } = mount('network', {
      jobId: '11111111-2222-3333-4444-555555555555'
    })

    expect(screen.queryByTestId('workflow-run-retry')).toBeNull()
    await userEvent.setup().click(screen.getByTestId('workflow-run-resume'))

    expect(emitted('press')).toEqual([['resume']])
  })
})
