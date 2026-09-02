// @vitest-environment jsdom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import CrdtDevPanel from './CrdtDevPanel.vue'
import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

vi.mock('@/scripts/api', () => ({
  api: { apiURL: (route: string) => `/api${route}` }
}))

const writeText = vi.fn<(value: string) => Promise<void>>(() =>
  Promise.resolve()
)

const status: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'doc-123',
  updatesApplied: 1,
  lastFrameType: 'doc_update'
}

function renderPanel(overrides: Partial<AgentCrdtStatus> = {}) {
  localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
  return render(CrdtDevPanel, {
    props: { status: { ...status, ...overrides } }
  })
}

describe('CrdtDevPanel clipboard controls', () => {
  beforeEach(() => {
    clearDevEvents()
    localStorage.clear()
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
    recordDevEvent('doc_nodes_changed', {
      added: ['node-added'],
      removed: ['node-removed']
    })
    renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy node id node-added' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Copy node id node-removed' })
    )

    expect(writeText).toHaveBeenNthCalledWith(1, 'node-added')
    expect(writeText).toHaveBeenNthCalledWith(2, 'node-removed')
  })

  it('copies the full log detail while displaying a truncated excerpt', async () => {
    const detail = { value: 'x'.repeat(220), bytes: new Uint8Array(3) }
    recordDevEvent('doc_update', detail)
    renderPanel()

    const full = JSON.stringify({
      value: 'x'.repeat(220),
      bytes: 'Uint8Array(3)'
    })
    expect(screen.getByText(`${full.slice(0, 200)}…`)).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy log detail' })
    )

    expect(writeText).toHaveBeenCalledExactlyOnceWith(full)
  })

  it('shows transient Copied feedback only on the button that succeeded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      recordDevEvent('doc_nodes_changed', { added: ['node-a'], removed: [] })
      renderPanel()

      const docButton = screen.getByRole('button', { name: 'Copy document id' })
      const nodeButton = screen.getByRole('button', {
        name: 'Copy node id node-a'
      })
      expect(docButton).toHaveTextContent('Copy')

      await userEvent.click(docButton)

      expect(docButton).toHaveTextContent('Copied')
      expect(nodeButton).toHaveTextContent('node-a')

      await vi.advanceTimersByTimeAsync(1200)

      expect(docButton).toHaveTextContent('Copy')
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives no Copied feedback when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'))
    renderPanel()

    const docButton = screen.getByRole('button', { name: 'Copy document id' })
    await userEvent.click(docButton)

    expect(writeText).toHaveBeenCalledOnce()
    expect(docButton).toHaveTextContent('Copy')
  })

  it('preserves full filtered-log copying', async () => {
    recordDevEvent('doc_update', { seq: 7 })
    recordDevEvent('doc_reset', { reason: 'remint' })
    renderPanel()

    await userEvent.selectOptions(
      screen.getByTestId('crdt-dev-panel-filter'),
      'doc_update'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Copy JSON' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      stringifyDevEvents(devEvents.value.filter((e) => e.kind === 'doc_update'))
    )
  })

  it('omits unavailable controls without writing', () => {
    recordDevEvent('doc_nodes_changed', undefined)
    renderPanel({ workflowId: null })

    expect(
      screen.queryByRole('button', { name: 'Copy document id' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Copy node id / })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy log detail' })
    ).not.toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
  })
})
