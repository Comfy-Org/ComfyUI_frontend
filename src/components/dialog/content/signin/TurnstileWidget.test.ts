import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render } from '@testing-library/vue'

import type { TurnstileRenderOptions } from '@/composables/auth/turnstileScript'

import TurnstileWidget from './TurnstileWidget.vue'

const { mockLoadTurnstile, mockGetSiteKey, mockLightTheme } = vi.hoisted(
  () => ({
    mockLoadTurnstile: vi.fn(),
    mockGetSiteKey: vi.fn(() => 'site-key'),
    mockLightTheme: { value: true }
  })
)

vi.mock('@/composables/auth/turnstileScript', () => ({
  loadTurnstile: mockLoadTurnstile
}))
vi.mock('@/config/turnstile', () => ({
  getTurnstileSiteKey: mockGetSiteKey
}))
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      get light_theme() {
        return mockLightTheme.value
      }
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      auth: {
        turnstile: {
          expired: 'Challenge expired',
          failed: 'Verification failed'
        }
      }
    }
  }
})

/** A controllable Cloudflare Turnstile global whose render() captures options. */
function fakeTurnstile() {
  let captured: TurnstileRenderOptions | undefined
  const api = {
    render: vi.fn((_el: unknown, options: TurnstileRenderOptions) => {
      captured = options
      return 'widget-id'
    }),
    reset: vi.fn(),
    remove: vi.fn()
  }
  return { api, options: () => captured }
}

/** Drain the onMounted async (loadTurnstile) plus any follow-up microtasks. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve))
}

const renderWidget = () =>
  render(TurnstileWidget, { global: { plugins: [i18n] } })

/**
 * Render TurnstileWidget through a thin host that keeps a ref to it, so the
 * exposed `reset()` method can be invoked the way a parent (SignUpForm) would.
 */
const renderWidgetWithExpose = () => {
  const widgetRef = ref<{ reset: () => void } | null>(null)
  const Host = defineComponent({
    setup(_, { emit }) {
      return () =>
        h(TurnstileWidget, {
          ref: widgetRef,
          'onUpdate:token': (value: string) => emit('update:token', value)
        })
    }
  })
  const utils = render(Host, { global: { plugins: [i18n] } })
  return {
    ...utils,
    getCurrentInstance: () => {
      if (!widgetRef.value) throw new Error('widget not mounted')
      return widgetRef.value
    }
  }
}

describe('TurnstileWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteKey.mockReturnValue('site-key')
    mockLightTheme.value = true
    delete window.turnstile
  })

  afterEach(() => {
    delete window.turnstile
  })

  it('renders the widget with the configured sitekey and light theme', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    renderWidget()
    await flush()

    expect(mockLoadTurnstile).toHaveBeenCalledOnce()
    expect(api.render).toHaveBeenCalledOnce()
    expect(options()?.sitekey).toBe('site-key')
    expect(options()?.theme).toBe('light')
  })

  it('uses the dark theme when the active palette is not light', async () => {
    mockLightTheme.value = false
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    renderWidget()
    await flush()

    expect(options()?.theme).toBe('dark')
  })

  it('emits the solved token via v-model and shows no error', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    const { emitted, container } = renderWidget()
    await flush()

    options()!.callback!('token-abc')
    await flush()

    expect(emitted()['update:token'].at(-1)).toEqual(['token-abc'])
    expect(container.textContent).not.toContain('Challenge expired')
    expect(container.textContent).not.toContain('Verification failed')
  })

  it('clears the token and surfaces the expired message on expiry', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    const { emitted, container } = renderWidget()
    await flush()

    options()!.callback!('token-abc')
    options()!['expired-callback']!()
    await flush()

    expect(emitted()['update:token'].at(-1)).toEqual([''])
    expect(container.textContent).toContain('Challenge expired')
  })

  it('clears the token and surfaces the failure message on widget error', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    const { emitted, container } = renderWidget()
    await flush()

    options()!.callback!('token-abc')
    options()!['error-callback']!()
    await flush()

    expect(emitted()['update:token'].at(-1)).toEqual([''])
    expect(container.textContent).toContain('Verification failed')
  })

  it('resets the widget on a challenge error to fetch a fresh challenge', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)
    window.turnstile = api as unknown as NonNullable<Window['turnstile']>

    renderWidget()
    await flush()

    options()!['error-callback']!()
    await flush()

    expect(api.reset).toHaveBeenCalledWith('widget-id')
  })

  it('shows the failure message when the Turnstile script fails to load', async () => {
    mockLoadTurnstile.mockRejectedValue(new Error('script failed'))

    const { container } = renderWidget()
    await flush()

    expect(container.textContent).toContain('Verification failed')
  })

  it('reset() clears the token model and resets the rendered widget', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)
    window.turnstile = api as unknown as NonNullable<Window['turnstile']>

    const { emitted, getCurrentInstance } = renderWidgetWithExpose()
    await flush()

    options()!.callback!('token-abc')
    await flush()
    expect(emitted()['update:token'].at(-1)).toEqual(['token-abc'])

    getCurrentInstance().reset()
    await flush()

    expect(api.reset).toHaveBeenCalledWith('widget-id')
    expect(emitted()['update:token'].at(-1)).toEqual([''])
  })

  it('reset() clears a stale error so it does not linger over a fresh challenge', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)
    window.turnstile = api as unknown as NonNullable<Window['turnstile']>

    const { container, getCurrentInstance } = renderWidgetWithExpose()
    await flush()

    options()!['error-callback']!()
    await flush()
    expect(container.textContent).toContain('Verification failed')

    getCurrentInstance().reset()
    await flush()
    expect(container.textContent).not.toContain('Verification failed')
  })

  it('reset() clears the token even when the widget never rendered', async () => {
    mockLoadTurnstile.mockRejectedValue(new Error('script failed'))

    const { emitted, getCurrentInstance } = renderWidgetWithExpose()
    await flush()

    getCurrentInstance().reset()
    await flush()

    // No widget id was captured, so window.turnstile.reset is never called,
    // but the token model is still cleared.
    expect(emitted()['update:token']?.at(-1) ?? ['']).toEqual([''])
  })

  it('removes the widget on unmount when one was rendered', async () => {
    const { api } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)
    window.turnstile = api as unknown as NonNullable<Window['turnstile']>

    const { unmount } = renderWidget()
    await flush()

    unmount()

    expect(api.remove).toHaveBeenCalledWith('widget-id')
  })

  // A widget that never resolves (broken script, ad-blocker, CDN outage, or a
  // hung challenge) must eventually tell the parent it cannot be relied on,
  // so submission can fall back instead of blocking a legitimate signup
  // forever.
  describe('unavailable fallback', () => {
    it('reports unavailable when the Turnstile script fails to load', async () => {
      mockLoadTurnstile.mockRejectedValue(new Error('script failed'))

      const { emitted } = renderWidget()
      await flush()

      expect(emitted()['update:unavailable']?.at(-1)).toEqual([true])
    })

    it('reports unavailable on a challenge error', async () => {
      const { api, options } = fakeTurnstile()
      mockLoadTurnstile.mockResolvedValue(api)

      const { emitted } = renderWidget()
      await flush()

      options()!['error-callback']!()
      await flush()

      expect(emitted()['update:unavailable']?.at(-1)).toEqual([true])
    })

    it('clears the unavailable fallback once a token is solved', async () => {
      const { api, options } = fakeTurnstile()
      mockLoadTurnstile.mockResolvedValue(api)

      const { emitted } = renderWidget()
      await flush()

      options()!['error-callback']!()
      await flush()
      expect(emitted()['update:unavailable']?.at(-1)).toEqual([true])

      options()!.callback!('token-abc')
      await flush()

      expect(emitted()['update:unavailable']?.at(-1)).toEqual([false])
    })

    it('falls back once the widget fails to resolve within the load timeout', async () => {
      vi.useFakeTimers()
      try {
        const { api, options } = fakeTurnstile()
        mockLoadTurnstile.mockResolvedValue(api)

        const { emitted } = renderWidget()
        // Let the onMounted hook's `await loadTurnstile()` microtask settle
        // and render() run, without yet advancing to the timeout itself.
        await vi.advanceTimersByTimeAsync(0)
        expect(options()).toBeDefined()
        expect(emitted()['update:unavailable']).toBeUndefined()

        await vi.advanceTimersByTimeAsync(9_000)

        expect(emitted()['update:unavailable']?.at(-1)).toEqual([true])
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not fall back once a token arrives before the load timeout', async () => {
      vi.useFakeTimers()
      try {
        const { api, options } = fakeTurnstile()
        mockLoadTurnstile.mockResolvedValue(api)

        const { emitted } = renderWidget()
        await vi.advanceTimersByTimeAsync(0)

        options()!.callback!('token-abc')
        await vi.advanceTimersByTimeAsync(9_000)

        expect(emitted()['update:unavailable']).toBeUndefined()
      } finally {
        vi.useRealTimers()
      }
    })

    it('resets the widget to fetch a fresh challenge on token expiry', async () => {
      const { api, options } = fakeTurnstile()
      mockLoadTurnstile.mockResolvedValue(api)
      window.turnstile = api as unknown as NonNullable<Window['turnstile']>

      renderWidget()
      await flush()

      options()!.callback!('token-abc')
      options()!['expired-callback']!()
      await flush()

      expect(api.reset).toHaveBeenCalledWith('widget-id')
    })

    it('falls back if a post-solve expiry is not followed by a fresh token within the load timeout', async () => {
      vi.useFakeTimers()
      try {
        const { api, options } = fakeTurnstile()
        mockLoadTurnstile.mockResolvedValue(api)
        window.turnstile = api as unknown as NonNullable<Window['turnstile']>

        const { emitted } = renderWidget()
        await vi.advanceTimersByTimeAsync(0)

        // Establish a solved, available widget: an initial error marks it
        // unavailable, then solving a challenge clears that (the same
        // transition the existing "clears the unavailable fallback" test
        // verifies), so the expiry below is the only thing driving fallback.
        options()!['error-callback']!()
        options()!.callback!('token-abc')
        expect(emitted()['update:unavailable']?.at(-1)).toEqual([false])

        // The token later expires (e.g. tab backgrounded past its ~300s
        // lifetime) without the widget itself erroring.
        options()!['expired-callback']!()
        await vi.advanceTimersByTimeAsync(0)

        // A fresh challenge was requested, but nothing solves it before the
        // re-armed load timeout elapses, so submission must eventually be
        // unblocked rather than staying stuck forever.
        expect(emitted()['update:unavailable']?.at(-1)).toEqual([false])
        await vi.advanceTimersByTimeAsync(9_000)

        expect(emitted()['update:unavailable']?.at(-1)).toEqual([true])
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
