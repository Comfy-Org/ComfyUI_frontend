import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
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

function setupComposable(): ReturnType<typeof useReconnectingNotification> {
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
    vi.advanceTimersByTime(2000)

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
    vi.advanceTimersByTime(2000)

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockToastRemove).not.toHaveBeenCalled()
  })

  it('removes toast and shows success when reconnected after delay', () => {
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(2000)
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
    vi.advanceTimersByTime(2000) // first toast fires
    onReconnecting() // second reconnecting event
    vi.advanceTimersByTime(2000) // second toast fires

    expect(mockToastAdd).toHaveBeenCalledTimes(2)
  })

  describe('tab visibility regained', () => {
    async function setVisibility(state: 'visible' | 'hidden') {
      Object.defineProperty(document, 'visibilityState', {
        value: state,
        configurable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
    }

    afterEach(async () => {
      await setVisibility('visible')
    })

    it('extends a pending reconnecting toast when the tab regains visibility', async () => {
      const { onReconnecting } = setupComposable()

      onReconnecting()
      vi.advanceTimersByTime(1000) // 1000ms into the base 2000ms delay

      await setVisibility('hidden')
      await setVisibility('visible')

      // Would have fired under the original (unextended) delay by now.
      vi.advanceTimersByTime(1900)
      expect(mockToastAdd).not.toHaveBeenCalled()

      // Extended delay (5000ms) elapses from the point visibility was regained.
      vi.advanceTimersByTime(3100)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Reconnecting' })
      )
    })

    it('avoids the reconnecting toast when reconnection completes shortly after refocus', async () => {
      const { onReconnecting, onReconnected } = setupComposable()

      onReconnecting()
      vi.advanceTimersByTime(1900) // just under the base delay

      await setVisibility('hidden')
      await setVisibility('visible')
      vi.advanceTimersByTime(200)
      onReconnected()
      vi.advanceTimersByTime(5000)

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockToastRemove).not.toHaveBeenCalled()
    })

    it('reverts to the base delay once the post-visibility grace period elapses', async () => {
      const { onReconnecting } = setupComposable()

      await setVisibility('hidden')
      await setVisibility('visible')
      vi.advanceTimersByTime(10000) // grace period elapses, no reconnect happened

      onReconnecting()
      vi.advanceTimersByTime(2000) // base delay again, not the extended one

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Reconnecting' })
      )
    })
  })
})
