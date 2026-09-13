import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { reportError, writeText } = vi.hoisted(() => ({
  reportError: vi.fn(),
  writeText: vi.fn<(value: string) => Promise<void>>(() => Promise.resolve())
}))

vi.mock<unknown>(import('@vueuse/core'), async (importOriginal) => ({
  ...(await importOriginal()),
  useClipboard: () => ({ copy: writeText })
}))
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import CrdtDevPanel from './CrdtDevPanel.vue'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import {
  MAX_CRDT_EVENT_DETAIL_EXPORT_BYTES,
  formatCrdtEventLog
} from './crdtDebugReport'
import { clearDevEvents, devEvents, recordDevEvent } from './devPanelLog'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: (route: string) => `/api${route}`,
    clientId: 'client-test-1',
    api_host: 'localhost:8188',
    api_base: ''
  }
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { serialize: () => ({ nodes: [], links: [] }) } }
}))

const status: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'doc-123',
  updatesApplied: 1,
  lastFrameType: 'doc_update',
  outcomes: {
    received: 1,
    applied: 1,
    skipped: 0,
    errored: 0,
    gap: 0,
    reset: 0,
    dropped: 0
  }
}

function renderPanel(overrides: Partial<AgentCrdtStatus> = {}) {
  localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
  return render(CrdtDevPanel, {
    props: { status: { ...status, ...overrides } }
  })
}

describe('CrdtDevPanel clipboard controls', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
    localStorage.clear()
    reportError.mockClear()
    writeText.mockClear()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
  })

  it('copies the displayed document id', async () => {
    renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy document id' })
    )

    expect(writeText).toHaveBeenCalledExactlyOnceWith('doc-123')
  })

  it('copies each node id surfaced by doc_nodes_changed', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_nodes_changed', {
      added: ['node-added'],
      removed: ['node-removed']
    })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-added' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-removed' })
    )

    expect(writeText).toHaveBeenNthCalledWith(1, 'node-added')
    expect(writeText).toHaveBeenNthCalledWith(2, 'node-removed')
  })

  it('redacts operation payload values out of a copied log detail', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', {
      op: 'set_widget',
      node_id: 'node-7',
      value: 'a prompt the tester did not choose to publish',
      bytes: new Uint8Array(3)
    })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        op: 'set_widget',
        node_id: 'node-7',
        value: '[redacted by the debug report]',
        bytes: 'Uint8Array(3)'
      })
    )
  })

  it('bounds a copied log detail while displaying a truncated excerpt', async () => {
    const user = userEvent.setup()
    const serialized = JSON.stringify({ message: 'x'.repeat(1_000_000) })
    recordDevEvent('schema_error', { message: 'x'.repeat(1_000_000) })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    expect(screen.getByText(`${serialized.slice(0, 200)}…`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    const copied = writeText.mock.calls[0][0]
    expect(copied).toContain('[CRDT event detail truncated]')
    expect(new TextEncoder().encode(copied).byteLength).toBeLessThanOrEqual(
      MAX_CRDT_EVENT_DETAIL_EXPORT_BYTES +
        new TextEncoder().encode('…[CRDT event detail truncated]').byteLength
    )
  })

  it('shows transient Copied feedback only on the button that succeeded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      recordDevEvent('doc_nodes_changed', { added: ['node-a'], removed: [] })
      renderPanel()

      const docButton = screen.getByRole('button', {
        name: 'Copy document id'
      })
      expect(docButton).toHaveTextContent('Copy')

      await userEvent.click(docButton)

      expect(docButton).toHaveTextContent('Copied')

      await vi.advanceTimersByTimeAsync(1600)

      expect(docButton).toHaveTextContent('Copy')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows transient Copy failed feedback when the clipboard write fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      writeText.mockRejectedValueOnce(new Error('NotAllowedError'))
      renderPanel()

      const docButton = screen.getByRole('button', {
        name: 'Copy document id'
      })
      await userEvent.click(docButton)

      expect(writeText).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'crdt_dev_panel_clipboard_write_failed'
      })
      expect(docButton).toHaveTextContent('Copy failed')

      await vi.advanceTimersByTimeAsync(1600)

      expect(docButton).toHaveTextContent(/^Copy$/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('copies exactly the bounded, warned log for the active filter', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', { seq: 7 })
    recordDevEvent('doc_reset', { reason: 'remint' })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-filter'),
      'doc_update'
    )
    await user.click(screen.getByRole('button', { name: 'Copy log' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      formatCrdtEventLog(
        devEvents.value.filter((event) => event.kind === 'doc_update')
      )
    )
  })

  it('omits unavailable controls without writing', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_nodes_changed', undefined)
    renderPanel({ workflowId: null })

    expect(
      screen.queryByRole('button', { name: 'Copy document id' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))
    expect(
      screen.queryByRole('button', { name: /^Copy node id / })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy log detail' })
    ).not.toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
  })
})
