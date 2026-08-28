import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => ({
  api: {
    getSystemStats: () => Promise.reject(new Error('offline')),
    getLogs: () => Promise.reject(new Error('offline')),
    getSettings: () => Promise.reject(new Error('offline')),
    apiURL: (path: string) => `http://backend${path}`
  }
}))
vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { serialize: () => ({ nodes: [], links: [] }) } }
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({ extensions: [] })
}))

import CrdtDevPanel from './CrdtDevPanel.vue'
import { clearDevEvents, recordDevEvent } from './devPanelLog'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const STATUS: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'doc-1',
  updatesApplied: 4,
  lastFrameType: 'doc_update'
}

function renderPanel() {
  return render(CrdtDevPanel, { props: { status: STATUS } })
}

const chip = () => screen.queryByTestId('crdt-dev-panel-chip')
const sheet = () => screen.queryByTestId('crdt-dev-panel')

describe('CrdtDevPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    clearDevEvents()
  })

  it('starts collapsed to a chip so it cannot cover the composer', () => {
    renderPanel()

    expect(chip()).toBeTruthy()
    expect(sheet()).toBeNull()
  })

  it('opens and closes back to the chip', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(chip()!)
    expect(sheet()).toBeTruthy()

    await user.click(screen.getByTestId('crdt-dev-panel-close'))
    expect(chip()).toBeTruthy()
    expect(sheet()).toBeNull()
  })

  it('removes the whole instrument when hidden, not just the sheet', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    await user.click(screen.getByTestId('crdt-dev-panel-dismiss'))

    // A chip left behind after "hide" is the bug: the mount gate is read once
    // at setup, so persisting the opt-out alone leaves it on screen.
    expect(chip()).toBeNull()
    expect(sheet()).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.CrdtDebug.enabled')).toBe('false')
  })

  it('filters the event log by the layer an event came from', async () => {
    const user = userEvent.setup()
    recordDevEvent('ws_out', { frame: 'a' }, { scope: 'wire' })
    recordDevEvent('doc_update', { seq: 1 }, { scope: 'doc' })
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))
    expect(screen.getByTestId('crdt-dev-panel-log').textContent).toContain(
      'ws_out'
    )

    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-scope-filter'),
      'doc'
    )

    const log = screen.getByTestId('crdt-dev-panel-log').textContent
    expect(log).toContain('doc_update')
    expect(log).not.toContain('ws_out')
  })

  it('explains a merge sequence without needing a backend', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-merge'))
    await user.click(screen.getByTestId('crdt-dev-panel-run'))

    const trace = screen.getByTestId('crdt-dev-panel-trace').textContent
    expect(trace).toContain('delete-wins')
    expect(trace).toContain('had already been deleted')
  })
})
