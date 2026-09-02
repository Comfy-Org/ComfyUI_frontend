import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import CrdtDevPanel from './CrdtDevPanel.vue'

const status = {
  enabled: true,
  connected: true,
  workflowId: 'workflow-1',
  updatesApplied: 0,
  lastFrameType: null
}

describe('CrdtDevPanel keyboard focus', () => {
  beforeEach(() => localStorage.clear())

  it('moves focus into the panel and restores it after Escape closes', async () => {
    const user = userEvent.setup()
    render(CrdtDevPanel, { props: { status } })

    const chip = screen.getByRole('button', { name: 'CRDT dev' })
    chip.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CRDT dev' })).toHaveFocus()
  })
})
