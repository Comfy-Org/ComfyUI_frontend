import { cleanup, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import CrdtDevPanel from './CrdtDevPanel.vue'
import { clearDevEvents, recordDevEvent } from './devPanelLog'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path = '') => `http://agent.test${path}`)
  }
}))

const OPEN_KEY = 'Comfy.Agent.CrdtDevPanel.open'

const baseStatus = (): AgentCrdtStatus => ({
  enabled: true,
  connected: true,
  workflowId: 'doc-123',
  updatesApplied: 7,
  lastFrameType: 'doc_update'
})

function mount(
  status: ComponentProps<typeof CrdtDevPanel>['status'] = baseStatus()
) {
  return render(CrdtDevPanel, {
    props: { status }
  })
}

function openPanel() {
  localStorage.setItem(OPEN_KEY, 'true')
}

function createClipboardSpy(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
}

describe('CrdtDevPanel', () => {
  beforeEach(() => {
    cleanup()
    vi.useFakeTimers()
    localStorage.clear()
    clearDevEvents()
    ;(window as unknown as { __agentCrdtPoc?: unknown }).__agentCrdtPoc =
      undefined
  })

  afterEach(vi.useRealTimers)

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    clearDevEvents()
    localStorage.clear()
  })

  it('opens and closes from the chip while persisting open state', async () => {
    mount()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    expect(screen.getByTestId('crdt-dev-panel-chip')).toBeVisible()

    await user.click(screen.getByTestId('crdt-dev-panel-chip'))

    expect(screen.getByText('CRDT Dev Panel (PoC)')).toBeVisible()
    expect(localStorage.getItem(OPEN_KEY)).toBe('true')

    await user.click(screen.getByTestId('crdt-dev-panel-close'))

    expect(screen.getByTestId('crdt-dev-panel-chip')).toBeVisible()
    expect(localStorage.getItem(OPEN_KEY)).toBe('false')
  })

  it('uses the persisted open state on mount', () => {
    openPanel()

    mount()

    expect(screen.getByText('CRDT Dev Panel (PoC)')).toBeVisible()
    expect(screen.queryByTestId('crdt-dev-panel-chip')).toBeNull()
  })

  it('renders follower status, polled globals, and derived event counters', async () => {
    openPanel()
    ;(window as unknown as { __agentCrdtPoc?: unknown }).__agentCrdtPoc = {
      tabId: 'tab-abc',
      lastSeq: 42
    }
    recordDevEvent('doc_reset', { reason: 'remint' })
    recordDevEvent('doc_nodes_changed', {
      added: ['node-a', 'node-b'],
      removed: ['node-c']
    })

    mount()
    await nextTick()

    expect(screen.getByText('doc-123')).toBeVisible()
    expect(screen.getByText('yes')).toBeVisible()
    expect(screen.getByText('7')).toBeVisible()
    expect(screen.getAllByText('doc_update')[0]).toBeVisible()
    expect(screen.getByText('tab-abc')).toBeVisible()
    expect(screen.getByText('42')).toBeVisible()
    expect(screen.getByText('http://agent.test')).toBeVisible()
    const log = screen.getByTestId('crdt-dev-panel-log')
    expect(within(log).getByText('doc_reset')).toBeVisible()
    expect(within(log).getByText('doc_nodes_changed')).toBeVisible()
    expect(screen.getByText('remints (doc_reset)')).toBeVisible()
    expect(screen.getByText('doc nodes added')).toBeVisible()
    expect(screen.getByText('doc nodes removed')).toBeVisible()
    expect(
      screen.getByRole('row', { name: 'remints (doc_reset) 1' })
    ).toBeVisible()
    expect(screen.getByRole('row', { name: 'doc nodes added 2' })).toBeVisible()
    expect(
      screen.getByRole('row', { name: 'doc nodes removed 1' })
    ).toBeVisible()
    expect(screen.getByText('2 events')).toBeVisible()
  })

  it('filters rendered events by kind without clearing the backing buffer', async () => {
    openPanel()
    recordDevEvent('schema_error', { reason: 'bad schema' })
    recordDevEvent('doc_update', { update_b64: 'abc' })

    mount()

    const log = screen.getByTestId('crdt-dev-panel-log')
    expect(within(log).getByText('schema_error')).toBeVisible()
    expect(within(log).getByText('doc_update')).toBeVisible()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-filter'),
      'schema_error'
    )

    expect(within(log).getByText('schema_error')).toBeVisible()
    expect(within(log).queryByText('doc_update')).toBeNull()
    expect(screen.getByText('2 events')).toBeVisible()
  })

  it('clears the event buffer from the panel action', async () => {
    openPanel()
    recordDevEvent('doc_update', { update_b64: 'abc' })
    mount()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.getByText('0 events')).toBeVisible()
    expect(
      within(screen.getByTestId('crdt-dev-panel-log')).queryByText('doc_update')
    ).toBeNull()
  })

  it('copies the filtered event log and restores the copy label timer', async () => {
    const writeClipboard = createClipboardSpy()
    openPanel()
    recordDevEvent('schema_error', { reason: 'bad schema' })
    recordDevEvent('doc_update', { update_b64: new Uint8Array([1, 2, 3]) })
    mount()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-filter'),
      'doc_update'
    )

    await user.click(screen.getByRole('button', { name: 'Copy JSON' }))

    expect(writeClipboard).toHaveBeenCalledTimes(1)
    const copied = writeClipboard.mock.calls[0][0]
    expect(copied).toContain('"kind": "doc_update"')
    expect(copied).not.toContain('"kind": "schema_error"')
    expect(copied).toContain('Uint8Array(3)')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible()

    vi.advanceTimersByTime(1200)
    await nextTick()

    expect(screen.getByRole('button', { name: 'Copy JSON' })).toBeVisible()
  })

  it('clears the poll interval and tolerates the copy-label timer after unmount', async () => {
    createClipboardSpy()
    openPanel()
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    recordDevEvent('doc_update', { update_b64: 'abc' })
    const { unmount } = mount()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByRole('button', { name: 'Copy JSON' }))
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(() => vi.runOnlyPendingTimers()).not.toThrow()

    clearIntervalSpy.mockRestore()
  })
})
