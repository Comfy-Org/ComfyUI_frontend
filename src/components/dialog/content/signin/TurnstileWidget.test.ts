import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render } from '@testing-library/vue'

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

type RenderOptions = {
  sitekey: string
  theme: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

/** A controllable Cloudflare Turnstile global whose render() captures options. */
function fakeTurnstile() {
  let captured: RenderOptions | undefined
  const api = {
    render: vi.fn((_el: unknown, options: RenderOptions) => {
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

    options()!.callback('token-abc')
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

    options()!.callback('token-abc')
    options()!['expired-callback']()
    await flush()

    expect(emitted()['update:token'].at(-1)).toEqual([''])
    expect(container.textContent).toContain('Challenge expired')
  })

  it('clears the token and surfaces the failure message on widget error', async () => {
    const { api, options } = fakeTurnstile()
    mockLoadTurnstile.mockResolvedValue(api)

    const { emitted, container } = renderWidget()
    await flush()

    options()!.callback('token-abc')
    options()!['error-callback']()
    await flush()

    expect(emitted()['update:token'].at(-1)).toEqual([''])
    expect(container.textContent).toContain('Verification failed')
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

    options()!.callback('token-abc')
    await flush()
    expect(emitted()['update:token'].at(-1)).toEqual(['token-abc'])

    getCurrentInstance().reset()
    await flush()

    expect(api.reset).toHaveBeenCalledWith('widget-id')
    expect(emitted()['update:token'].at(-1)).toEqual([''])
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
})
