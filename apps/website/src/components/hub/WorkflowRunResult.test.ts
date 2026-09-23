import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { RunState } from '../../composables/useWorkflowRun'
import WorkflowRunResult from './WorkflowRunResult.vue'

const mount = (state: RunState, memberWorkspace?: string) =>
  render(WorkflowRunResult, {
    props: { state, outputs: [], memberWorkspace }
  })

describe('WorkflowRunResult', () => {
  // Stopping a run on purpose is not a failure and is not dressed as one.
  it('tells a cancelled run apart from a failed one', async () => {
    const { emitted } = mount({ phase: 'cancelled' })

    expect(screen.queryByTestId('workflow-run-error')).toBeNull()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run it again' }))

    expect(emitted('press')).toEqual([['retry']])
  })

  // The panel does not decide what a refusal says; it hands over which one it
  // was, and whose workspace could not pay for it.
  it('hands a refusal on with its reason and the workspace', () => {
    mount(
      { phase: 'error', reason: 'noCredits', retrySafe: true },
      'Comfy Design'
    )

    const box = screen.getByTestId('workflow-run-error')
    expect(box.getAttribute('data-reason')).toBe('noCredits')
    expect(box.textContent).toContain('Comfy Design')
  })

  it('carries the way out back up from the refusal', async () => {
    const { emitted } = mount({
      phase: 'error',
      reason: 'rateLimit',
      retrySafe: true
    })

    await userEvent.setup().click(screen.getByTestId('workflow-run-retry'))

    expect(emitted('press')).toEqual([['retry']])
  })

  it('shows what a run makes before one has been asked for', () => {
    mount({ phase: 'idle' })
    // No sample given, so nothing is drawn in its place either.
    expect(screen.queryByTestId('workflow-run-sample')).toBeNull()

    render(WorkflowRunResult, {
      props: { state: { phase: 'idle' }, outputs: [], sample: '/still.webp' }
    })

    expect(screen.getByTestId('workflow-run-sample')).toBeTruthy()
  })
})
