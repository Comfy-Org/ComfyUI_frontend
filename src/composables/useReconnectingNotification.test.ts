import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectingNotification } from '@/composables/useReconnectingNotification'

const mockToastAdd = vi.fn()
const mockToastRemove = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd,
    remove: mockToastRemove
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

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
    const { onReconnecting } = useReconnectingNotification()

    onReconnecting()

    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('shows error toast after delay', () => {
    const { onReconnecting } = useReconnectingNotification()

    onReconnecting()
    vi.advanceTimersByTime(1500)

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'g.reconnecting'
      })
    )
  })

  it('suppresses toast when reconnected before delay expires', () => {
    const { onReconnecting, onReconnected } = useReconnectingNotification()

    onReconnecting()
    vi.advanceTimersByTime(500)
    onReconnected()
    vi.advanceTimersByTime(1500)

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('removes toast and shows success when reconnected after delay', () => {
    const { onReconnecting, onReconnected } = useReconnectingNotification()

    onReconnecting()
    vi.advanceTimersByTime(1500)
    mockToastAdd.mockClear()

    onReconnected()

    expect(mockToastRemove).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'g.reconnecting'
      })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'g.reconnected',
        life: 2000
      })
    )
  })

  it('does nothing when toast is disabled via setting', () => {
    settingMocks.disableToast = true
    const { onReconnecting, onReconnected } = useReconnectingNotification()

    onReconnecting()
    vi.advanceTimersByTime(1500)
    onReconnected()

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('handles multiple reconnecting events without duplicating toasts', () => {
    const { onReconnecting } = useReconnectingNotification()

    onReconnecting()
    vi.advanceTimersByTime(500)
    onReconnecting()
    vi.advanceTimersByTime(1500)

    expect(mockToastAdd).toHaveBeenCalledTimes(1)
  })
})
