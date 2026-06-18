import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileGlobal = NonNullable<Window['turnstile']>

const fakeApi = (): TurnstileGlobal => ({
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

  it('rejects and clears the cache when the script loads without the global', async () => {
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    // load fires but Cloudflare never set window.turnstile
    scriptEl()!.dispatchEvent(new Event('load'))

    await expect(promise).rejects.toThrow(/without global/i)
    // cache was reset → a later call starts a brand-new load
    expect(loadTurnstile()).not.toBe(promise)
  })

  it('rejects, removes the self-appended script, and clears the cache on load error', async () => {
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    scriptEl()!.dispatchEvent(new Event('error'))

    await expect(promise).rejects.toThrow(/failed to load/i)
    expect(scriptEl()).toBeNull()
    expect(loadTurnstile()).not.toBe(promise)
  })

  it('rejects, removes the script, and clears the cache on timeout', async () => {
    vi.useFakeTimers()
    const loadTurnstile = await freshLoadTurnstile()

    const promise = loadTurnstile()
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    vi.advanceTimersByTime(10_000)

    await assertion
    expect(scriptEl()).toBeNull()
  })

  it('reuses a pre-existing script tag and leaves it in place on error', async () => {
    const existing = new FakeScript()
    existing.src = TURNSTILE_SRC
    inserted.push(existing)

    const loadTurnstile = await freshLoadTurnstile()
    const promise = loadTurnstile()

    // no duplicate appended
    expect(scriptCount()).toBe(1)

    existing.dispatchEvent(new Event('error'))
    await expect(promise).rejects.toThrow()
    // only self-appended scripts are removed; a pre-existing tag is left alone
    expect(scriptEl()).not.toBeNull()
  })
})
