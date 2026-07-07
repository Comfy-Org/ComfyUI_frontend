import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi } from '@/composables/auth/turnstileScript'

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const fakeApi = (): TurnstileApi => ({
  render: vi.fn(() => 'widget-id'),
  reset: vi.fn(),
  remove: vi.fn()
})

/**
 * Controllable stand-in for the injected <script>. We never insert a real
 * external script because jsdom would try (and fail) to fetch it and fire its
 * own `error` event, making `load` impossible to simulate deterministically.
 * Instead `createElement`/`querySelector`/`appendChild` are spied to route
 * through this fake, so the test drives `load`/`error`/timeout itself.
 */
class FakeScript {
  src = ''
  async = false
  private handlers: Record<string, Array<(e: Event) => void>> = {}

  addEventListener(type: string, cb: (e: Event) => void) {
    ;(this.handlers[type] ??= []).push(cb)
  }

  dispatchEvent(event: Event): boolean {
    for (const cb of this.handlers[event.type] ?? []) cb(event)
    return true
  }

  remove() {
    const i = inserted.indexOf(this)
    if (i >= 0) inserted.splice(i, 1)
  }
}

let inserted: FakeScript[] = []

const scriptEl = (): FakeScript | null =>
  inserted.find((s) => s.src === TURNSTILE_SRC) ?? null

const scriptCount = () => inserted.filter((s) => s.src === TURNSTILE_SRC).length

/**
 * The module keeps a private singleton promise, so each test imports a fresh
 * copy after `vi.resetModules()`.
 */
async function freshLoadTurnstile() {
  vi.resetModules()
  const mod = await import('@/composables/auth/turnstileScript')
  return mod.loadTurnstile
}

describe('loadTurnstile', () => {
  beforeEach(() => {
    inserted = []
    delete window.turnstile

    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'script'
        ? (new FakeScript() as unknown as HTMLElement)
        : realCreateElement(tag)
    )
    vi.spyOn(document, 'querySelector').mockImplementation((sel: string) =>
      typeof sel === 'string' && sel.includes('challenges.cloudflare.com')
        ? (scriptEl() as unknown as Element | null)
        : null
    )
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
      inserted.push(node as unknown as FakeScript)
      return node
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('resolves immediately with the existing global and appends no script', async () => {
    const api = fakeApi()
    window.turnstile = api

    const loadTurnstile = await freshLoadTurnstile()

    await expect(loadTurnstile()).resolves.toBe(api)
    expect(scriptEl()).toBeNull()
  })

  it('appends the script and resolves once it loads and exposes the global', async () => {
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    const el = scriptEl()
    expect(el).not.toBeNull()
    expect(el?.async).toBe(true)

    const api = fakeApi()
    window.turnstile = api
    el!.dispatchEvent(new Event('load'))

    await expect(promise).resolves.toBe(api)
  })

  it('caches the in-flight promise so concurrent callers share one load', async () => {
    const loadTurnstile = await freshLoadTurnstile()

    const p1 = loadTurnstile()
    const p2 = loadTurnstile()

    expect(p1).toBe(p2)
    expect(scriptCount()).toBe(1)
  })

  it('polls for the global when it is published asynchronously after the load event', async () => {
    vi.useFakeTimers()
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    scriptEl()!.dispatchEvent(new Event('load'))
    // global published shortly after load
    const api = fakeApi()
    window.turnstile = api
    await vi.advanceTimersByTimeAsync(50)

    await expect(promise).resolves.toBe(api)
    // tag stays in place on success
    expect(scriptEl()).not.toBeNull()
  })

  it('rejects and clears the cache when the global never appears after load (poll timeout)', async () => {
    vi.useFakeTimers()
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    scriptEl()!.dispatchEvent(new Event('load'))
    // global never published; deadline elapses
    // oxlint-disable-next-line vitest/valid-expect -- deliberately awaited after the timer advance below; awaiting here would deadlock fake timers
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(10_000)

    await assertion
    // dead tag is removed so a later retry starts clean
    expect(scriptEl()).toBeNull()
    // cache was reset → a later call starts a brand-new load
    const retry = loadTurnstile()
    expect(retry).not.toBe(promise)
    // settle the throwaway retry so it doesn't leak a 10s timer
    retry.catch(() => {})
    scriptEl()!.dispatchEvent(new Event('error'))
    await expect(retry).rejects.toThrow()
  })

  it('rejects, removes the self-appended script, and clears the cache on load error', async () => {
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    scriptEl()!.dispatchEvent(new Event('error'))

    await expect(promise).rejects.toThrow(/failed to load/i)
    expect(scriptEl()).toBeNull()
    // cache was reset → a later call starts a brand-new load
    const retry = loadTurnstile()
    expect(retry).not.toBe(promise)
    // settle the throwaway retry so it doesn't leak a 10s timer
    retry.catch(() => {})
    scriptEl()!.dispatchEvent(new Event('error'))
    await expect(retry).rejects.toThrow()
  })

  it('rejects, removes the script, and clears the cache on timeout', async () => {
    vi.useFakeTimers()
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    // oxlint-disable-next-line vitest/valid-expect -- deliberately awaited after the timer advance below; awaiting here would deadlock fake timers
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    vi.advanceTimersByTime(10_000)

    await assertion
    expect(scriptEl()).toBeNull()
  })

  it('reuses a pre-existing script tag and resolves promptly once the global appears (no duplicate, tag left in place)', async () => {
    vi.useFakeTimers()
    const existing = new FakeScript()
    existing.src = TURNSTILE_SRC
    inserted.push(existing)

    const loadTurnstile = await freshLoadTurnstile()
    const promise = loadTurnstile()

    // no duplicate appended
    expect(scriptCount()).toBe(1)

    // The pre-existing tag's load event may have already fired before we
    // attached listeners, so resolution must come from polling for the global
    // rather than from a (dead) load event.
    const api = fakeApi()
    window.turnstile = api
    await vi.advanceTimersByTimeAsync(50)

    await expect(promise).resolves.toBe(api)
    // a pre-existing tag is left alone (never removed by this loader)
    expect(scriptEl()).not.toBeNull()
  })

  it('reuses a pre-existing script tag and times out (clearing the cache) if the global never appears, leaving the tag in place', async () => {
    vi.useFakeTimers()
    const existing = new FakeScript()
    existing.src = TURNSTILE_SRC
    inserted.push(existing)

    const loadTurnstile = await freshLoadTurnstile()
    const promise = loadTurnstile()
    // oxlint-disable-next-line vitest/valid-expect -- deliberately awaited after the timer advance below; awaiting here would deadlock fake timers
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(10_000)

    await assertion
    // pre-existing tag is never removed by the loader
    expect(scriptEl()).not.toBeNull()
    // cache was reset → a later call starts a brand-new load
    const retry = loadTurnstile()
    expect(retry).not.toBe(promise)
    // drain the throwaway retry's timer/promise so nothing leaks
    retry.catch(() => {})
    await vi.advanceTimersByTimeAsync(10_000)
  })
})
