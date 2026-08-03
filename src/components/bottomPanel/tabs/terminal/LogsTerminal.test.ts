import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'

const apiMock = vi.hoisted(
  () =>
    new (class extends EventTarget {
      clientId: string | null = 'test-client'
      getRawLogs = vi.fn(async () => ({ entries: [{ m: 'log line\n' }] }))
      subscribeLogs = vi.fn(async () => {})
    })()
)

vi.mock('@/scripts/api', () => ({ api: apiMock }))

const terminalMock = vi.hoisted(() => ({
  open: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
  reset: vi.fn(),
  scrollToBottom: vi.fn(),
  onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  selectAll: vi.fn(),
  clearSelection: vi.fn()
}))

vi.mock('@/composables/bottomPanelTabs/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    terminal: terminalMock,
    useAutoSize: vi.fn(() => ({ resize: vi.fn() }))
  }))
}))

vi.mock('@/components/bottomPanel/tabs/terminal/BaseTerminal.vue', async () => {
  const { defineComponent, ref } = await import('vue')
  const { useTerminal } =
    await import('@/composables/bottomPanelTabs/useTerminal')
  return {
    default: defineComponent({
      emits: ['created'],
      setup(_, { emit }) {
        const root = ref<HTMLElement | undefined>(undefined)
        emit('created', useTerminal(root), root)
        return () => null
      }
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      logsTerminal: {
        loadError:
          'Unable to load logs, please ensure you have updated your ComfyUI backend.',
        resyncError:
          'Unable to resync logs after the backend reconnected. Reopen the console to retry.'
      }
    }
  }
})

const renderLogsTerminal = () =>
  render(LogsTerminal, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: { execution: { clientId: 'test-client' } }
        }),
        i18n
      ]
    }
  })

// Silence the production console.error calls in error-path tests. Vitest
// isolates this file's module graph so the spy does not affect other files.
vi.spyOn(console, 'error').mockImplementation(() => {})

// Resolve a getRawLogs call manually to drive deterministic timing in tests
// that need to observe behavior mid-fetch.
const deferredRawLogs = () => {
  let resolve!: (value: { entries: { m: string }[] }) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<{ entries: { m: string }[] }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('LogsTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.clientId = 'test-client'
  })

  it('loads logs and subscribes to streaming on mount', async () => {
    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
      expect(terminalMock.write).toHaveBeenCalledWith('log line\n')
    })
  })

  it('resyncs, snaps to tail, and re-subscribes on "reconnected"', async () => {
    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
    })

    apiMock.dispatchEvent(new CustomEvent('reconnected'))

    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(2)
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
      expect(terminalMock.scrollToBottom).toHaveBeenCalledTimes(1)
      expect(apiMock.subscribeLogs).toHaveBeenCalledTimes(2)
      expect(apiMock.subscribeLogs).toHaveBeenLastCalledWith(true)
    })

    // The full sequence must be: reset -> write -> scroll -> subscribe
    const resetOrder = terminalMock.reset.mock.invocationCallOrder[0]
    const writeOrder = terminalMock.write.mock.invocationCallOrder.at(-1)!
    const scrollOrder = terminalMock.scrollToBottom.mock.invocationCallOrder[0]
    const subscribeOrder =
      apiMock.subscribeLogs.mock.invocationCallOrder.at(-1)!
    expect(resetOrder).toBeLessThan(writeOrder)
    expect(writeOrder).toBeLessThan(scrollOrder)
    expect(scrollOrder).toBeLessThan(subscribeOrder)
  })

  it('aborts an in-flight resync when a second "reconnected" arrives', async () => {
    renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
    })

    // First resync hangs on getRawLogs
    const first = deferredRawLogs()
    apiMock.getRawLogs.mockImplementationOnce(() => first.promise)
    apiMock.dispatchEvent(new CustomEvent('reconnected'))
    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(2)
    })

    // Second resync resolves immediately
    apiMock.getRawLogs.mockImplementationOnce(async () => ({
      entries: [{ m: 'fresh\n' }]
    }))
    apiMock.dispatchEvent(new CustomEvent('reconnected'))
    await vi.waitFor(() => {
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
    })

    // Now resolve the first (aborted) resync — none of its side effects must apply
    first.resolve({ entries: [{ m: 'stale\n' }] })
    await nextTick()
    await nextTick()

    expect(terminalMock.reset).toHaveBeenCalledTimes(1)
    expect(terminalMock.write).not.toHaveBeenCalledWith('stale\n')
    expect(terminalMock.write).toHaveBeenCalledWith('fresh\n')
  })

  it('aborts an in-flight mount fetch when "reconnected" arrives first', async () => {
    // Mount's getRawLogs hangs so we can drive the race deterministically.
    const mount = deferredRawLogs()
    apiMock.getRawLogs.mockImplementationOnce(() => mount.promise)
    renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
    })

    // Resync wins the race and writes the post-reboot snapshot.
    apiMock.getRawLogs.mockImplementationOnce(async () => ({
      entries: [{ m: 'fresh\n' }]
    }))
    apiMock.dispatchEvent(new CustomEvent('reconnected'))
    await vi.waitFor(() => {
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
      expect(terminalMock.write).toHaveBeenCalledWith('fresh\n')
    })

    // Mount's late response must not stomp on the freshly-reset terminal.
    mount.resolve({ entries: [{ m: 'stale-mount\n' }] })
    await nextTick()
    await nextTick()

    expect(terminalMock.write).not.toHaveBeenCalledWith('stale-mount\n')
  })

  it('surfaces an inline error when the resync fetch fails', async () => {
    renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
    })

    apiMock.getRawLogs.mockRejectedValueOnce(new Error('boom'))

    apiMock.dispatchEvent(new CustomEvent('reconnected'))

    await vi.waitFor(() => {
      expect(
        screen.getByTestId('terminal-error-message').textContent
      ).toContain('Unable to resync logs')
    })
  })

  it('shows a load error when the initial fetch fails', async () => {
    apiMock.getRawLogs.mockRejectedValueOnce(new Error('boom'))

    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(
        screen.getByTestId('terminal-error-message').textContent
      ).toContain('Unable to load logs')
    })
  })

  it('recovers from an initial load failure when a reconnect arrives', async () => {
    apiMock.getRawLogs
      .mockRejectedValueOnce(new Error('initial fail'))
      .mockResolvedValueOnce({ entries: [{ m: 'recovered\n' }] })

    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(
        screen.getByTestId('terminal-error-message').textContent
      ).toContain('Unable to load logs')
    })

    apiMock.dispatchEvent(new CustomEvent('reconnected'))

    await vi.waitFor(() => {
      expect(screen.queryByTestId('terminal-error-message')).toBeNull()
      expect(screen.queryByTestId('terminal-loading-spinner')).toBeNull()
      expect(terminalMock.write).toHaveBeenCalledWith('recovered\n')
    })
  })

  it('cleans up listeners and unsubscribes on unmount', async () => {
    const { unmount } = renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
    })

    unmount()
    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(false)
    })

    apiMock.dispatchEvent(new CustomEvent('reconnected'))
    await nextTick()

    expect(terminalMock.reset).not.toHaveBeenCalled()
    // No additional getRawLogs beyond the mount-time call
    expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
  })

  it('does not write to the terminal when unmount happens mid-fetch', async () => {
    const pending = deferredRawLogs()
    apiMock.getRawLogs.mockImplementationOnce(() => pending.promise)

    const { unmount } = renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
    })

    unmount()
    pending.resolve({ entries: [{ m: 'late\n' }] })
    await nextTick()
    await nextTick()

    expect(terminalMock.write).not.toHaveBeenCalled()
  })
})
