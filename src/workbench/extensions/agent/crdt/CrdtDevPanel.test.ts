import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import CrdtDevPanel from './CrdtDevPanel.vue'
import { clearDevEvents, recordDevEvent } from './devPanelLog'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

vi.mock('@/scripts/api', () => ({
  api: { apiURL: vi.fn((url: string) => url) }
}))

function baseStatus(overrides: Partial<AgentCrdtStatus> = {}): AgentCrdtStatus {
  return {
    enabled: true,
    connected: true,
    workflowId: 'wf-1',
    updatesApplied: 0,
    lastFrameType: null,
    replayState: 'idle',
    ...overrides
  }
}

async function renderOpenPanel(status: AgentCrdtStatus = baseStatus()) {
  const utils = render(CrdtDevPanel, {
    props: { status },
    global: { plugins: [i18n] }
  })
  const user = userEvent.setup()
  await user.click(screen.getByTestId('crdt-dev-panel-chip'))
  return { user, ...utils }
}

describe('CrdtDevPanel', () => {
  afterEach(() => {
    clearDevEvents()
  })

  it('mm3-25 renders the live replay state in the status table', async () => {
    await renderOpenPanel(baseStatus({ replayState: 'partial' }))

    expect(screen.getByText('replay state')).toBeInTheDocument()
    expect(screen.getByText('partial')).toBeInTheDocument()
  })

  it('mm3-25 exposes replay_state and replay_step as filterable event kinds', async () => {
    await renderOpenPanel()

    const filter = screen.getByRole('combobox', {
      name: 'Filter event log by kind'
    })
    const optionValues = Array.from((filter as HTMLSelectElement).options).map(
      (o) => o.value
    )

    expect(optionValues).toEqual(
      expect.arrayContaining(['replay_state', 'replay_step'])
    )
  })

  it('mm3-25 gives the event-kind filter select an accessible name', async () => {
    await renderOpenPanel()

    expect(
      screen.getByRole('combobox', { name: 'Filter event log by kind' })
    ).toBeInTheDocument()
  })

  it('mm3-25 makes the event-log scrolling region keyboard focusable', async () => {
    recordDevEvent('replay_state', { state: 'loading' })
    await renderOpenPanel()

    const log = screen.getByTestId('crdt-dev-panel-log')
    expect(log).toHaveAttribute('tabindex', '0')
    expect(log).toHaveAttribute('role', 'log')

    log.focus()
    expect(log).toHaveFocus()
  })

  it('mm3-25 filters the event log to replay_state/replay_step kinds', async () => {
    recordDevEvent('doc_update', { n: 1 })
    recordDevEvent('replay_state', { state: 'complete' })
    const { user } = await renderOpenPanel()

    const filter = screen.getByRole('combobox', {
      name: 'Filter event log by kind'
    })
    await user.selectOptions(filter, 'replay_state')

    const log = screen.getByTestId('crdt-dev-panel-log')
    expect(log.textContent).toContain('replay_state')
    expect(log.textContent).not.toContain('doc_update')
  })
})
