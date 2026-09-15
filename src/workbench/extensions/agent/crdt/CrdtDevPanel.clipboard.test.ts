import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn<(text: string) => Promise<boolean>>(() =>
    Promise.resolve(true)
  )
}))

vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copied: ref(false), copyToClipboard })
}))

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import CrdtDevPanel from './CrdtDevPanel.vue'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import * as crdtDebugReport from './crdtDebugReport'
import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

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
    props: { status: { ...status, ...overrides } },
    global: { plugins: [i18n] }
  })
}

describe('CrdtDevPanel clipboard controls', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
    localStorage.clear()
    copyToClipboard.mockClear()
    copyToClipboard.mockResolvedValue(true)
  })

  it('copies the displayed document id', async () => {
    renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy document id' })
    )

    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith('doc-123')
  })

  it('keeps a report available for manual copy after clipboard failure and retries', async () => {
    const report = '# Diagnostic report\n\nCollected context'
    const collectReport = vi
      .spyOn(crdtDebugReport, 'collectCrdtDebugReport')
      .mockResolvedValue(report)
    copyToClipboard.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Copy full report' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Clipboard access failed. Select and copy the report below, or retry.'
    )
    const manualCopy = screen.getByRole('textbox', { name: 'Report to copy' })
    expect(manualCopy).toHaveValue(report)
    expect(manualCopy).toHaveAttribute('readonly')

    await user.click(screen.getByRole('button', { name: 'Retry copy report' }))

    expect(copyToClipboard).toHaveBeenLastCalledWith(report)
    expect(collectReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
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

    expect(copyToClipboard).toHaveBeenNthCalledWith(1, 'node-added')
    expect(copyToClipboard).toHaveBeenNthCalledWith(2, 'node-removed')
  })

  it('copies the full log detail while displaying a truncated excerpt', async () => {
    const user = userEvent.setup()
    // Long enough to truncate, and built from retained structural ids: a
    // free-form string is summarized by length before it ever reaches the
    // panel, so it can no longer produce an over-long excerpt.
    const added = Array.from({ length: 30 }, (_, index) => `node-${index}`)
    recordDevEvent('doc_update', { added, bytes: new Uint8Array(3) })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    const full = JSON.stringify({ added, bytes: 'Uint8Array(3)' })
    expect(screen.getByText(`${full.slice(0, 200)}…`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith(full)
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
      copyToClipboard.mockResolvedValueOnce(false)
      renderPanel()

      const docButton = screen.getByRole('button', {
        name: 'Copy document id'
      })
      await userEvent.click(docButton)

      expect(copyToClipboard).toHaveBeenCalledOnce()
      expect(docButton).toHaveTextContent('Copy failed')

      await vi.advanceTimersByTimeAsync(1600)

      expect(docButton).toHaveTextContent(/^Copy$/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves full filtered-log copying', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', { seq: 7 })
    recordDevEvent('doc_reset', { reason: 'remint' })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(screen.getByTestId('crdt-dev-panel-filter'))
    await user.click(screen.getByRole('option', { name: 'doc_update' }))
    await user.click(screen.getByRole('button', { name: 'Copy log' }))

    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith(
      stringifyDevEvents(devEvents.value.filter((e) => e.kind === 'doc_update'))
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
    expect(copyToClipboard).not.toHaveBeenCalled()
  })
})
