import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HubRunStates from './HubRunStates.vue'

describe('HubRunStates', () => {
  // The jobs are built through the real response schema, so a status the API
  // stopped accepting takes the whole sheet down rather than drawing a state
  // nobody can reach.
  it('draws every state the panel can be in', () => {
    render(HubRunStates)

    expect(screen.getAllByTestId('run-state-scene')).toHaveLength(11)
  })

  it('shows what a run makes before one has been asked for', () => {
    render(HubRunStates)

    expect(screen.getByTestId('workflow-run-sample')).toBeTruthy()
  })

  // The two errors are not the same error: one of them leaves a run behind.
  it('offers the way back to a run only where one exists', () => {
    render(HubRunStates)

    expect(screen.getAllByTestId('workflow-run-error')).toHaveLength(2)
    expect(screen.getAllByTestId('workflow-run-resume')).toHaveLength(1)
  })
})
