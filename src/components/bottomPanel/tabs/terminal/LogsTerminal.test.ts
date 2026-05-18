import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'

const apiMock = vi.hoisted(() => {
  const target = new EventTarget() as EventTarget & {
    clientId: string | null
    getRawLogs: ReturnType<typeof vi.fn>
    subscribeLogs: ReturnType<typeof vi.fn>
  }
  target.clientId = 'test-client'
  target.getRawLogs = vi.fn(async () => ({ entries: [{ m: 'log line\n' }] }))
  target.subscribeLogs = vi.fn(async () => {})
  return target
})

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

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

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

describe('LogsTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resyncs logs, re-subscribes, and scrolls to bottom on "reconnected"', async () => {
    renderLogsTerminal()

    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
    })

    apiMock.dispatchEvent(new CustomEvent('reconnected'))

    // Backend loses its per-client log subscription on restart, so the
    // terminal must reset + refetch + re-subscribe + snap to the new tail.
    await vi.waitFor(() => {
      expect(terminalMock.reset).toHaveBeenCalledTimes(1)
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(2)
      expect(terminalMock.scrollToBottom).toHaveBeenCalledTimes(1)
      expect(apiMock.subscribeLogs).toHaveBeenCalledTimes(2)
      expect(apiMock.subscribeLogs).toHaveBeenLastCalledWith(true)
    })
  })

  it('stops handling "reconnected" after unmount', async () => {
    const { unmount } = renderLogsTerminal()

    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(true)
      expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
    })

    unmount()
    await vi.waitFor(() => {
      expect(apiMock.subscribeLogs).toHaveBeenCalledWith(false)
    })

    apiMock.dispatchEvent(new CustomEvent('reconnected'))

    expect(terminalMock.reset).not.toHaveBeenCalled()
    expect(apiMock.getRawLogs).toHaveBeenCalledTimes(1)
  })
})
