import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { writeText } = vi.hoisted(() => ({
  writeText: vi.fn<(value: string) => Promise<void>>(() => Promise.resolve())
}))

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useClipboard: () => ({ copy: writeText })
}))

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import CrdtDevPanel from './CrdtDevPanel.vue'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => `/api${route}`,
    clientId: 'client-test-1',
    api_host: 'localhost:8188',
    api_base: ''
  }
}))
vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { serialize: () => ({ nodes: [], links: [] }) } }
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({ extensions: [] })
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

  it('copies the full log detail while displaying a truncated excerpt', async () => {
    const user = userEvent.setup()
    const detail = { value: 'x'.repeat(220), bytes: new Uint8Array(3) }
    recordDevEvent('doc_update', detail)
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    const full = JSON.stringify({
      value: 'x'.repeat(220),
      bytes: 'Uint8Array(3)'
    })
    expect(screen.getByText(`${full.slice(0, 200)}…`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(full)
  })

  it('shows transient Copied feedback only on the button that succeeded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      recordDevEvent('doc_nodes_changed', { added: ['node-a'], removed: [] })
      renderPanel()

      const docButton = screen.getByRole('button', {
        name: 'Copy document id'
      })
      expect(docButton).toHaveTextContent(/^Copy$/)

      await userEvent.click(docButton)

      expect(docButton).toHaveTextContent('Copied')

      await vi.advanceTimersByTimeAsync(1600)

      expect(docButton).toHaveTextContent(/^Copy$/)
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

    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-filter'),
      'doc_update'
    )
    await user.click(screen.getByRole('button', { name: 'Copy log' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      stringifyDevEvents(devEvents.value.filter((e) => e.kind === 'doc_update'))
    )
  })

  it('handles malformed and duplicate node-id lists and caps their controls', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_nodes_changed', { added: 1, removed: 'node' })
    recordDevEvent('doc_nodes_changed', {
      added: Array.from({ length: 52 }, (_, index) => `node-${index}`),
      removed: ['node-0', 'node-51']
    })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    expect(
      screen.getAllByRole('button', { name: /^Copy node id / })
    ).toHaveLength(50)
    expect(screen.getByText('+2 more')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Copy node id node-0' })
    ).toHaveLength(1)
  })

  it('serializes circular and bigint details without losing their content', async () => {
    const user = userEvent.setup()
    const detail: { count: bigint; self?: unknown } = { count: 7n }
    detail.self = detail
    recordDevEvent('doc_update', detail)
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))
    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      '{"count":"7","self":"[Circular]"}'
    )
  })

  it('bounds retained details and truncates excerpts on code-point boundaries', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', 'x'.repeat(20_100))
    recordDevEvent('doc_reset', `${'x'.repeat(198)}😀tail`)
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    expect(screen.getByText(`"${'x'.repeat(198)}😀…`)).toBeInTheDocument()
    const detailButtons = screen.getAllByRole('button', {
      name: 'Copy log detail'
    })
    await user.click(detailButtons[1])
    expect(String(writeText.mock.calls[0][0])).toHaveLength(20_001)
    expect(writeText.mock.calls[0][0]).toMatch(/…$/)
  })

  it('keeps feedback on the latest click when writes settle out of order', async () => {
    let resolveFirst: (() => void) | undefined
    let resolveSecond: (() => void) | undefined
    writeText
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveFirst = resolve))
      )
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveSecond = resolve))
      )
    recordDevEvent('doc_nodes_changed', {
      added: ['node-a', 'node-b'],
      removed: []
    })
    renderPanel()
    await userEvent.click(screen.getByTestId('crdt-dev-panel-tab-log'))
    const first = screen.getByRole('button', { name: 'Copy node id node-a' })
    const second = screen.getByRole('button', { name: 'Copy node id node-b' })

    first.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    second.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    resolveSecond?.()
    await vi.waitFor(() => expect(second).toHaveTextContent('Copied'))
    resolveFirst?.()
    await vi.waitFor(() => expect(second).toHaveTextContent('Copied'))
    expect(first).toHaveTextContent('node-a')
  })

  it('does not update feedback after unmount', async () => {
    let resolveWrite: (() => void) | undefined
    writeText.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveWrite = resolve))
    )
    const panel = renderPanel()

    void userEvent.click(
      screen.getByRole('button', { name: 'Copy document id' })
    )
    panel.unmount()
    resolveWrite?.()

    await Promise.resolve()
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
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
