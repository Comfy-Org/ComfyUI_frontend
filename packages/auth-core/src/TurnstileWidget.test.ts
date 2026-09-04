import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { TurnstileApi, TurnstileRenderOptions } from './turnstileScript'
import TurnstileWidget from './TurnstileWidget.vue'

/** A controllable Cloudflare Turnstile global whose render() captures options. */
function fakeTurnstile() {
  let captured: TurnstileRenderOptions | undefined
  const api: TurnstileApi = {
    render: vi.fn((_el, options) => {
      captured = options
      return 'widget-id'
    }),
    reset: vi.fn(),
    remove: vi.fn()
  }
  return { api, options: () => captured! }
}

/** Drain the onMounted async (the injected loader) plus follow-up microtasks. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve))
}

const baseProps = {
  siteKey: 'site-key',
  expiredMessage: 'Challenge expired',
  failedMessage: 'Verification failed'
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  delete window.turnstile
})

describe('TurnstileWidget', () => {
  it('renders the challenge with the given sitekey and theme', async () => {
    const { api, options } = fakeTurnstile()
    window.turnstile = api
    render(TurnstileWidget, {
      props: { ...baseProps, theme: 'light', loader: async () => api }
    })
    await flush()

    expect(api.render).toHaveBeenCalledOnce()
    expect(options().sitekey).toBe('site-key')
    expect(options().theme).toBe('light')
  })

  it('publishes the token when the challenge resolves', async () => {
    const { api, options } = fakeTurnstile()
    window.turnstile = api
    const { emitted } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()

    options().callback?.('token-abc')

    expect(emitted('update:token').at(-1)).toEqual(['token-abc'])
  })

  it('recovers a timed-out widget: a late token clears the unavailable state', async () => {
    const { api, options } = fakeTurnstile()
    window.turnstile = api
    const { emitted } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()
    // The load timeout fires first, marking the widget unavailable.
    await vi.advanceTimersByTimeAsync(9_000)
    expect(emitted('update:unavailable').at(-1)).toEqual([true])

    // Then the challenge resolves late — the parent must be un-blocked.
    options().callback?.('late-token')

    expect(emitted('update:token').at(-1)).toEqual(['late-token'])
    expect(
      emitted('update:unavailable').at(-1),
      'a slow-but-valid Turnstile must un-block signup, not leave it stuck'
    ).toEqual([false])
  })

  it('clears the token, shows the expired copy, and requests a fresh challenge on expiry', async () => {
    const { api, options } = fakeTurnstile()
    window.turnstile = api
    const { emitted } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()
    options().callback?.('token-abc')

    options()['expired-callback']?.()
    await flush()

    expect(emitted('update:token').at(-1)).toEqual([''])
    expect(screen.getByRole('alert').textContent).toContain('Challenge expired')
    expect(api.reset).toHaveBeenCalledWith('widget-id')
  })

  it('reports unavailable with the failed copy when the challenge errors', async () => {
    const { api, options } = fakeTurnstile()
    window.turnstile = api
    const { emitted } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()

    options()['error-callback']?.()
    await flush()

    expect(emitted('update:unavailable').at(-1)).toEqual([true])
    expect(screen.getByRole('alert').textContent).toContain(
      'Verification failed'
    )
  })

  it('reports unavailable when the script fails to load', async () => {
    const { emitted } = render(TurnstileWidget, {
      props: {
        ...baseProps,
        loader: async () => {
          throw new Error('blocked')
        }
      }
    })
    await flush()

    expect(emitted('update:unavailable').at(-1)).toEqual([true])
  })

  it('falls back to unavailable when the challenge never resolves in time', async () => {
    const { api } = fakeTurnstile()
    window.turnstile = api
    const { emitted } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()

    await vi.advanceTimersByTimeAsync(9_000)

    expect(emitted('update:unavailable').at(-1)).toEqual([true])
  })

  it('exposes reset(): clears the token, re-arms, and asks Turnstile for a fresh challenge', async () => {
    const { api } = fakeTurnstile()
    window.turnstile = api
    const widgetRef = ref<{ reset: () => void } | null>(null)
    const unavailableUpdates: boolean[] = []
    const Host = defineComponent({
      setup() {
        return () =>
          h(TurnstileWidget, {
            ...baseProps,
            loader: async () => api,
            ref: widgetRef,
            'onUpdate:unavailable': (value: boolean) => {
              unavailableUpdates.push(value)
            }
          })
      }
    })
    render(Host)
    await flush()
    // Let the load timeout mark the widget unavailable first, so the reset's
    // second chance is observable as a real false transition.
    await vi.advanceTimersByTimeAsync(9_000)
    expect(unavailableUpdates.at(-1)).toBe(true)

    widgetRef.value!.reset()
    await flush()

    expect(api.reset).toHaveBeenCalledWith('widget-id')
    expect(unavailableUpdates.at(-1)).toBe(false)
  })

  it('removes the challenge on unmount', async () => {
    const { api } = fakeTurnstile()
    window.turnstile = api
    const { unmount } = render(TurnstileWidget, {
      props: { ...baseProps, loader: async () => api }
    })
    await flush()

    unmount()

    expect(api.remove).toHaveBeenCalledWith('widget-id')
  })
})
