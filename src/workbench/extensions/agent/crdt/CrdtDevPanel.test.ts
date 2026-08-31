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
import { setCrdtDebugEnabled } from './crdtDebugGate'
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
const restore = () => screen.queryByTestId('crdt-dev-panel-restore')

describe('CrdtDevPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    // The gate caches its value, so clearing storage behind it is not enough
    // to undo a previous test's dismissal.
    setCrdtDebugEnabled(true)
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

  it('replaces the instrument with a way to restore it when hidden', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    await user.click(screen.getByTestId('crdt-dev-panel-dismiss'))

    expect(chip()).toBeNull()
    expect(sheet()).toBeNull()
    expect(restore()).toBeTruthy()
    expect(localStorage.getItem('Comfy.Agent.CrdtDebug.enabled')).toBe('false')

    await user.click(restore()!)

    expect(chip()).toBeTruthy()
    expect(restore()).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.CrdtDebug.enabled')).toBe('true')
  })

  it('keeps the restore affordance across a remount', async () => {
    const user = userEvent.setup()
    const first = renderPanel()
    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-dismiss'))

    // The panel lives in a slot inside `v-if="!showHistory"`, so opening chat
    // history destroys and re-creates it. Per-mount state alone would bring a
    // deliberately hidden chip back with no user action.
    first.unmount()
    renderPanel()

    expect(chip()).toBeNull()
    expect(sheet()).toBeNull()
    expect(restore()).toBeTruthy()
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

  it('shows the sensitive-source opt-ins as off, and lets them be turned on', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    // These three are the only consent gate on logs, settings and the workflow
    // reaching the clipboard, so their state has to be readable. A bare
    // <input type="checkbox"> renders at 0x0 here: agentPanel.css strips
    // `appearance` from every input under #agent-panel-root.
    for (const key of ['serverLogs', 'settings', 'workflow']) {
      const toggle = screen.getByTestId(`crdt-dev-panel-include-${key}`)
      expect(toggle.getAttribute('role')).toBe('switch')
      expect(toggle.getAttribute('aria-checked')).toBe('false')

      await user.click(toggle)
      expect(
        screen
          .getByTestId(`crdt-dev-panel-include-${key}`)
          .getAttribute('aria-checked')
      ).toBe('true')
    }
  })

  it('explains a merge sequence without needing a backend', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-merge'))

    expect(
      screen.getByTestId('crdt-dev-panel-simulation-label')
    ).toHaveTextContent('Simulated — not this session')

    await user.click(screen.getByTestId('crdt-dev-panel-run'))

    const trace = screen.getByTestId('crdt-dev-panel-trace').textContent
    expect(trace).toContain('delete-wins')
    expect(trace).toContain('had already been deleted')
  })
})
