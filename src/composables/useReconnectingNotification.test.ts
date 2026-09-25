import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import { useSettingStore } from '@/platform/settings/settingStore'

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

describe('useReconnectingNotification', () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Toast.DisableReconnectingToast'] =
      false
  })

  it('does not show toast immediately on reconnecting', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()

    expect(useToast().toasts).toEqual([])
  })

  it('shows error toast after delay', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(2000)

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: 'Reconnecting'
      })
    )
  })

  it('suppresses toast when reconnected before delay expires', () => {
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(500)
    onReconnected()
    vi.advanceTimersByTime(2000)

    expect(useToast().toasts).toEqual([])
  })

  it('removes toast and shows success when reconnected after delay', () => {
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(2000)
    onReconnected()

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'success',
        title: 'Reconnected',
        duration: 2000
      })
    ])
  })

  it('does nothing when toast is disabled via setting', () => {
    useSettingStore().settingValues['Comfy.Toast.DisableReconnectingToast'] =
      true
    const { onReconnecting, onReconnected } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(1500)
    onReconnected()

    expect(useToast().toasts).toEqual([])
  })

  it('does nothing when onReconnected is called without prior onReconnecting', () => {
    const { onReconnected } = setupComposable()

    onReconnected()

    expect(useToast().toasts).toEqual([])
  })

  it('handles multiple reconnecting events without duplicating toasts', () => {
    const { onReconnecting } = setupComposable()

    onReconnecting()
    vi.advanceTimersByTime(2000) // first toast fires
    onReconnecting() // second reconnecting event
    vi.advanceTimersByTime(2000) // second toast fires

    expect(useToast().toasts).toHaveLength(2)
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
      expect(useToast().toasts).toEqual([])

      // Extended delay (5000ms) elapses from the point visibility was regained.
      vi.advanceTimersByTime(3100)
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({ kind: 'error', title: 'Reconnecting' })
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

      expect(useToast().toasts).toEqual([])
    })

    it('reverts to the base delay once the post-visibility grace period elapses', async () => {
      const { onReconnecting } = setupComposable()

      await setVisibility('hidden')
      await setVisibility('visible')
      vi.advanceTimersByTime(10000) // grace period elapses, no reconnect happened

      onReconnecting()
      vi.advanceTimersByTime(2000) // base delay again, not the extended one

      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({ kind: 'error', title: 'Reconnecting' })
      )
    })
  })
})
