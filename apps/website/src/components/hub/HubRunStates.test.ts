import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { WORKFLOW_FAILURES } from '../../lib/hub/run-failure'
import HubRunStates from './HubRunStates.vue'

describe('HubRunStates', () => {
  // The jobs are built through the real response schema, so a status the API
  // stopped accepting takes the whole sheet down rather than drawing a state
  // nobody can reach.
  it('draws every state the panel can be in', () => {
    render(HubRunStates)

    expect(screen.getAllByTestId('run-state-scene').length).toBeGreaterThan(
      WORKFLOW_FAILURES.length
    )
  })

  // The point of the sheet is that nothing is missing from it. A reason the
  // engine can produce and the sheet does not draw is one nobody has looked at.
  it('draws each way a run can be refused', () => {
    render(HubRunStates)

    const drawn = screen
      .getAllByTestId('workflow-run-error')
      .map((box) => box.getAttribute('data-reason'))

    expect(new Set(drawn)).toEqual(new Set(WORKFLOW_FAILURES))
  })

  it('shows what a run makes before one has been asked for', () => {
    render(HubRunStates)

    expect(screen.getByTestId('workflow-run-sample')).toBeTruthy()
  })

  // Three outcomes that are not the same outcome: one leaves a run behind,
  // one was nobody's fault, and one is the reader's own doing.
  it('tells resuming, buying and cancelling apart', () => {
    render(HubRunStates)

    expect(screen.getAllByTestId('workflow-run-resume')).toHaveLength(1)
    expect(screen.getAllByTestId('workflow-run-credits')).toHaveLength(1)
    expect(screen.getAllByTestId('workflow-run-personal')).toHaveLength(1)
    expect(screen.getAllByTestId('workflow-run-cancelled')).toHaveLength(1)
  })
})
