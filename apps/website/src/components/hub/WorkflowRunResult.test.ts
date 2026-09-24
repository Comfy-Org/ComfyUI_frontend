import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { zJobDetailResponse } from '@comfyorg/ingest-types/zod'

import type { RunState } from '../../composables/useWorkflowRun'
import WorkflowRunResult from './WorkflowRunResult.vue'

const JOB = zJobDetailResponse.parse({
  id: '11111111-2222-3333-4444-555555555555',
  status: 'in_progress',
  create_time: 0n,
  update_time: 0n
})

const PENDING = zJobDetailResponse.parse({
  id: '66666666-7777-8888-9999-000000000000',
  status: 'pending',
  create_time: 0n,
  update_time: 0n
})

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

  // The model half's panel names the state it is in on the panel itself, and
  // a reader crossing between the two halves reads the same thing.
  it.for([
    { state: { phase: 'idle' }, named: 'idle' },
    {
      state: { phase: 'tracking', job: JOB, startedAt: Date.now() },
      named: 'tracking'
    },
    { state: { phase: 'cancelled' }, named: 'cancelled' }
  ] as const)('names the state it is in as $named', ({ state, named }) => {
    mount(state)

    expect(
      screen.getByTestId('workflow-run-result').getAttribute('data-state')
    ).toBe(named)
  })

  // The wait reads the way a model's does: where the run is now, with the
  // count beside it. What it will do next is not on the panel.
  it('says where the run is now, once, with the count beside it', () => {
    mount({ phase: 'tracking', job: JOB, startedAt: Date.now() - 74_000 })

    expect(screen.getByTestId('workflow-run-elapsed').textContent).toContain(
      '1:14'
    )
    expect(screen.getAllByText('Generating…', { exact: true })).toHaveLength(1)
    expect(screen.queryByText('Waiting its turn')).toBeNull()
  })

  // The one workflow that wakes a server of its own is waiting on that, not
  // in a queue, and the reason its first run is slow sits under the line.
  it('names the server it is waking and why that run is the slow one', () => {
    render(WorkflowRunResult, {
      props: {
        state: {
          phase: 'tracking',
          job: PENDING,
          startedAt: Date.now()
        },
        outputs: [],
        coldStart: true
      }
    })

    expect(screen.getByText('Waking its server')).toBeTruthy()
    expect(screen.getByText('The first run takes longer.')).toBeTruthy()
  })

  // Before a run, the panel shows what this workflow makes and marks it as
  // the example it is, where a model page shows the model's own.
  it('marks what it shows before a run as an example', () => {
    render(WorkflowRunResult, {
      props: { state: { phase: 'idle' }, outputs: [], sample: '/still.webp' }
    })

    expect(screen.getByTestId('workflow-run-sample')).toBeTruthy()
    expect(screen.getByTestId('workflow-run-example')).toBeTruthy()
  })

  // A workflow with nothing of its own to show falls back to the same empty
  // panel a model's playground draws.
  it('draws the empty panel when there is nothing to show yet', () => {
    mount({ phase: 'idle' })

    expect(screen.queryByTestId('workflow-run-sample')).toBeNull()
    expect(screen.getByText('Your output will appear here.')).toBeTruthy()
  })
})
