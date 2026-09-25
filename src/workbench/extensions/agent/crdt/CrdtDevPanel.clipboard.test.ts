import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from '@vueuse/core'

import { i18n } from '@/i18n'

const { writeText } = vi.hoisted(() => ({
  writeText: vi.fn<ReturnType<typeof useClipboard>['copy']>(() =>
    Promise.resolve()
  )
}))

vi.mock(import('@vueuse/core'), { spy: true })
vi.mocked(useClipboard).mockReturnValue(fromPartial({ copy: writeText }))

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import CrdtDevPanel from './CrdtDevPanel.vue'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import * as crdtDebugReport from './crdtDebugReport'
import type { DevEvent } from './devPanelLog'
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
    appliedLive: 1,
    skipped: 0,
    errored: 0,
    gap: 0,
    reset: 0,
    dropped: 0
  }
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
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
    vi.mocked(useClipboard).mockReturnValue(fromPartial({ copy: writeText }))
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

  it('keeps a report available for manual copy after clipboard failure and retries', async () => {
    const report = '# Diagnostic report\n\nCollected context'
    const collectReport = vi
      .spyOn(crdtDebugReport, 'collectCrdtDebugReport')
      .mockResolvedValue(report)
    vi.mocked(useClipboard).mockReturnValue(
      fromPartial({ copy: vi.fn(() => Promise.resolve()) })
    )
    const user = userEvent.setup()
    const writeReport = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
      .mockRejectedValueOnce(
        new DOMException('Clipboard denied', 'NotAllowedError')
      )
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Copy full report' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Clipboard access failed. Select and copy the report below, or retry.'
    )
    const manualCopy = screen.getByRole('textbox', { name: 'Report to copy' })
    expect(manualCopy).toHaveValue(report)
    expect(manualCopy).toHaveAttribute('readonly')

    await user.click(screen.getByRole('button', { name: 'Retry copy report' }))

    expect(writeReport).toHaveBeenLastCalledWith(report)
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

    expect(writeText).toHaveBeenNthCalledWith(1, 'node-added')
    expect(writeText).toHaveBeenNthCalledWith(2, 'node-removed')
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

  it('keeps the log usable when a node-id list changes between reads', async () => {
    const user = userEvent.setup()
    const detail: { removed: string[] } = { removed: ['node-removed'] }
    let addedReads = 0
    Object.defineProperty(detail, 'added', {
      configurable: true,
      enumerable: false,
      get: () => (addedReads++ === 0 ? ['node-added'] : 1)
    })
    devEvents.value = [
      {
        seq: 1,
        at: Date.now(),
        kind: 'doc_nodes_changed',
        scope: 'doc',
        level: 'info',
        detail
      } satisfies DevEvent
    ]
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-added' })
    )

    expect(writeText).toHaveBeenCalledExactlyOnceWith('node-added')
  })

  it('keeps the log usable when node-id properties throw', async () => {
    const user = userEvent.setup()
    const addedThrows: unknown = Object.defineProperty(
      { removed: ['node-removed'] },
      'added',
      {
        get: () => {
          throw new Error('added is unreadable')
        }
      }
    )
    const removedThrows: unknown = Object.defineProperty(
      { added: ['node-added'] },
      'removed',
      {
        get: () => {
          throw new Error('removed is unreadable')
        }
      }
    )
    recordDevEvent('doc_nodes_changed', addedThrows)
    recordDevEvent('doc_nodes_changed', removedThrows)
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-removed' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-added' })
    )

    expect(writeText).toHaveBeenNthCalledWith(1, 'node-removed')
    expect(writeText).toHaveBeenNthCalledWith(2, 'node-added')
  })

  it('keeps the log usable when a node-id array cannot be iterated', async () => {
    const user = userEvent.setup()
    const unreadableIds = new Proxy(['node-unreadable'], {
      get: (target, property, receiver) => {
        if (property === Symbol.iterator) {
          throw new Error('node ids cannot be iterated')
        }
        return Reflect.get(target, property, receiver)
      }
    })
    recordDevEvent('doc_nodes_changed', {
      added: unreadableIds,
      removed: ['node-retained']
    })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    await user.click(
      screen.getByRole('button', { name: 'Copy node id node-retained' })
    )

    expect(writeText).toHaveBeenCalledExactlyOnceWith('node-retained')
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

  it('falls back to String() when a detail refuses to serialize', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', {
      toJSON() {
        throw new Error('not serializable')
      }
    })
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    expect(screen.getByText('[object Object]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy log detail' }))

    expect(writeText).toHaveBeenCalledExactlyOnceWith('[object Object]')
  })

  it('bounds retained details and truncates excerpts on code-point boundaries', async () => {
    const user = userEvent.setup()
    devEvents.value = [
      {
        seq: 1,
        at: Date.now(),
        kind: 'doc_update',
        scope: 'doc',
        level: 'info',
        detail: 'x'.repeat(20_100)
      },
      {
        seq: 2,
        at: Date.now(),
        kind: 'doc_reset',
        scope: 'doc',
        level: 'info',
        detail: `${'x'.repeat(198)}😀tail`
      }
    ] satisfies readonly DevEvent[]
    renderPanel()
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    expect(screen.getByText(`"${'x'.repeat(198)}😀…`)).toBeInTheDocument()
    const detailButtons = screen.getAllByRole('button', {
      name: 'Copy log detail'
    })
    await user.click(detailButtons[1])
    expect(writeText.mock.calls[0][0]).toHaveLength(20_001)
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
    expect(writeText).toHaveBeenCalledTimes(2)
    resolveSecond?.()
    await vi.waitFor(() => expect(second).toHaveTextContent(/^Copied$/))
    resolveFirst?.()
    await flushPromises()

    expect(second).toHaveTextContent(/^Copied$/)
    expect(first).toHaveTextContent(/^node-a$/)
  })

  it('does not update feedback after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let resolveWrite: (() => void) | undefined
      writeText.mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveWrite = resolve))
      )
      const panel = renderPanel()
      screen
        .getByRole('button', { name: 'Copy document id' })
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(writeText).toHaveBeenCalledOnce()

      panel.unmount()
      expect(vi.getTimerCount()).toBe(0)
      resolveWrite?.()
      await flushPromises()

      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
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
