import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { useReconnectingNotification } from '@/composables/useReconnectingNotification'

const mockToastAdd = vi.fn()
const mockToastRemove = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd,
    remove: mockToastRemove
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        reconnecting: 'Reconnecting',
        reconnected: 'Reconnected'
      }
    }
  }
})

function setupComposable(): ReturnType<typeof useReconnectingNotification> {
  let result!: ReturnType<typeof useReconnectingNotification>
  const Wrapper = defineComponent({
    setup() {
      result = useReconnectingNotification()
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return result
}

const settingMocks = vi.hoisted(() => ({
  disableToast: false
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.Toast.DisableReconnectingToast')
        return settingMocks.disableToast
      return undefined
    })
  }))
}))

describe('useReconnectingNotification', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers()
    vi.clearAllMocks()
    settingMocks.disableToast = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show toast immediately on reconnecting', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()

    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('shows error toast after delay', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(1500)

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Reconnecting'
      })
    )
  })

  it('suppresses toast when reconnected before delay expires', () => {
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(500)
    onReconnected()
    vi.advanceTimersByTime(1500)

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('removes toast and shows success when reconnected after delay', () => {
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(1500)
    mockToastAdd.mockClear()

    onReconnected()

    expect(mockToastRemove).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Reconnecting'
      })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Reconnected',
        life: 2000
      })
    )
  })

  it('does nothing when toast is disabled via setting', () => {
    settingMocks.disableToast = true
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(1500)
    onReconnected()

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('does nothing when onReconnected is called without prior onReconnecting', () => {
    const { onReconnected } = setupComposable()

    onReconnected()

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('handles multiple reconnecting events without duplicating toasts', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(1500) // first toast fires
    onReconnecting() // second reconnecting event
    vi.advanceTimersByTime(1500) // second toast fires

    expect(mockToastAdd).toHaveBeenCalledTimes(2)
  })
})
