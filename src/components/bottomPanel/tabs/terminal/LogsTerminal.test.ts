import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'
import { useExecutionStore } from '@/stores/executionStore'
import { api } from '@/scripts/api'

const apiMock = vi.mocked(api)

vi.mock(import('@/scripts/api'))

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

vi.mock<unknown>(import('@/composables/bottomPanelTabs/useTerminal'), () => ({
  useTerminal: vi.fn(() => ({
    terminal: terminalMock,
    useAutoSize: vi.fn(() => ({ resize: vi.fn() }))
  }))
}))

vi.mock(
  import('@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'),
  async () => {
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
  }
)

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
      plugins: [getActivePinia()!, i18n]
    }
  })

const deferredRawLogs = () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.getRawLogs>>) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<Awaited<ReturnType<typeof api.getRawLogs>>>(
    (res, rej) => {
      resolve = res
      reject = rej
    }
  )
  return { promise, resolve, reject }
}

describe('LogsTerminal', () => {
  beforeEach(() => {
    apiMock.clientId = 'test-client'
    apiMock.getRawLogs.mockResolvedValue({
      entries: [{ t: '00:00:00', m: 'log line\n' }],
      size: { cols: 80, row: 24 }
    })
    useExecutionStore().clientId = 'test-client'
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

    apiMock.dispatchCustomEvent('reconnected')

    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(2)
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
      expect(terminalMock.scrollToBottom).toHaveBeenCalledTimes(1)
      expect(apiMock.subscribeLogs).toHaveBeenCalledTimes(2)
      expect(apiMock.subscribeLogs).toHaveBeenLastCalledWith(true)
    })

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

    const first = deferredRawLogs()
    apiMock.getRawLogs.mockImplementationOnce(() => first.promise)
    apiMock.dispatchCustomEvent('reconnected')
    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(2)
    })

    apiMock.getRawLogs.mockImplementationOnce(async () => ({
      entries: [{ t: '00:00:00', m: 'fresh\n' }],
      size: { cols: 80, row: 24 }
    }))
    apiMock.dispatchCustomEvent('reconnected')
    await vi.waitFor(() => {
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
    })

    first.resolve({
      entries: [{ t: '00:00:00', m: 'stale\n' }],
      size: { cols: 80, row: 24 }
    })
    await nextTick()
    await nextTick()

    expect(terminalMock.reset).toHaveBeenCalledTimes(1)
    expect(terminalMock.write).not.toHaveBeenCalledWith('stale\n')
    expect(terminalMock.write).toHaveBeenCalledWith('fresh\n')
  })

  it('aborts an in-flight mount fetch when "reconnected" arrives first', async () => {
    const mount = deferredRawLogs()
    apiMock.getRawLogs.mockImplementationOnce(() => mount.promise)
    renderLogsTerminal()
    await vi.waitFor(() => {
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
    })

    apiMock.getRawLogs.mockImplementationOnce(async () => ({
      entries: [{ t: '00:00:00', m: 'fresh\n' }],
      size: { cols: 80, row: 24 }
    }))
    apiMock.dispatchCustomEvent('reconnected')
    await vi.waitFor(() => {
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
      expect(terminalMock.write).toHaveBeenCalledWith('fresh\n')
    })

    mount.resolve({
      entries: [{ t: '00:00:00', m: 'stale-mount\n' }],
      size: { cols: 80, row: 24 }
    })
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

    apiMock.dispatchCustomEvent('reconnected')

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
      .mockResolvedValueOnce({
        entries: [{ t: '00:00:00', m: 'recovered\n' }],
        size: { cols: 80, row: 24 }
      })

    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(
        screen.getByTestId('terminal-error-message').textContent
      ).toContain('Unable to load logs')
    })

    apiMock.dispatchCustomEvent('reconnected')

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

    apiMock.dispatchCustomEvent('reconnected')
    await nextTick()

    expect(terminalMock.reset).not.toHaveBeenCalled()
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
    pending.resolve({
      entries: [{ t: '00:00:00', m: 'late\n' }],
      size: { cols: 80, row: 24 }
    })
    await nextTick()
    await nextTick()

    expect(terminalMock.write).not.toHaveBeenCalled()
  })
})
