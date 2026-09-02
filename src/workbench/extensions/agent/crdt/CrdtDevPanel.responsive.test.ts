import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CrdtDevPanel from './CrdtDevPanel.vue'

vi.mock('@/scripts/api', () => ({
  api: { apiURL: () => '/api' }
}))

const status = {
  enabled: true,
  connected: false,
  workflowId: null,
  updatesApplied: 0,
  lastFrameType: null
}

describe('CrdtDevPanel responsive sizing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('caps the open panel to the viewport without changing its existing layout contracts', async () => {
    render(CrdtDevPanel, { props: { status } })
    const root = screen.getByTestId('crdt-dev-panel')
    const chip = screen.getByTestId('crdt-dev-panel-chip')

    expect(root).toHaveClass('right-3', 'bottom-3')
    expect(chip).toHaveClass('rounded-full', 'px-3', 'py-1')

    await userEvent.click(chip)

    const panel = screen.getByTestId('crdt-dev-panel-open')
    expect(panel).toHaveClass(
      'w-[calc(100vw-1.5rem)]',
      'max-w-[420px]',
      'max-h-[70vh]',
      'overflow-hidden'
    )
    expect(screen.getByTestId('crdt-dev-panel-content')).toHaveClass(
      'overflow-y-auto'
    )
    expect(screen.getByTestId('crdt-dev-panel-log')).toHaveClass(
      'max-h-56',
      'overflow-y-auto'
    )
  })
})
