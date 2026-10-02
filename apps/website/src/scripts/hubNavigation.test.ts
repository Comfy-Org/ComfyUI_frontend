import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRoutes } from '@/config/routes'

import { HUB_TOOLBAR_ID } from './hubToolbar'

const routes = getRoutes('en')
const ORIGIN = 'https://www.comfy.org'

/** Matches `PIN_TIMEOUT_MS`, which the module keeps to itself. */
const PIN_TIMEOUT_MS = 3000

const VIEWPORT = 800
const TALL_PAGE = 5000
/** Short enough that the pinned scroll would not fit inside it. */
const SHORT_PAGE = 820

const STICKY_OFFSET = 64
const TOOLBAR_FLOW_TOP = 300
const PINNED_SCROLL = TOOLBAR_FLOW_TOP - STICKY_OFFSET

/** The window geometry the module measures, which happy-dom does not lay out. */
const page = { scrollHeight: TALL_PAGE, innerHeight: VIEWPORT, scrollY: 0 }

Object.defineProperty(document.documentElement, 'scrollHeight', {
  configurable: true,
  get: () => page.scrollHeight
})
Object.defineProperty(window, 'innerHeight', {
  configurable: true,
  get: () => page.innerHeight
})
Object.defineProperty(window, 'scrollY', {
  configurable: true,
  get: () => page.scrollY
})

function stubScrollTo() {
  const scrollTo = vi.fn((_x: number, y: number) => {
    page.scrollY = y
  })
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollTo
  })
  return scrollTo
}

/**
 * Stands in for a real observer: it hands back the callback so a test can fire
 * it, and stays silent once the module has disconnected it, exactly as the
 * browser would.
 */
class FakeObserver {
  connected = true
  readonly targets: unknown[] = []

  constructor(private readonly callback: () => void) {}

  observe(target: unknown) {
    this.targets.push(target)
  }

  disconnect() {
    this.connected = false
  }

  fire() {
    if (this.connected) this.callback()
  }
}

function stubObserver(name: 'MutationObserver' | 'ResizeObserver') {
  const created: FakeObserver[] = []
  vi.stubGlobal(
    name,
    class extends FakeObserver {
      constructor(callback: () => void) {
        super(callback)
        created.push(this)
      }
    }
  )
  return created
}

interface ToolbarGeometry {
  /** Where the toolbar sits once the page has scrolled, i.e. its own `top`. */
  sticksAt?: number
  /** Its position in flow, which is what the module adds up from `offsetTop`. */
  flowTop?: number
  /** Where it is painted right now, which says whether it is already pinned. */
  paintedTop?: number
}

function addToolbar({
  sticksAt = STICKY_OFFSET,
  flowTop = TOOLBAR_FLOW_TOP,
  paintedTop = 0
}: ToolbarGeometry = {}) {
  const toolbar = document.createElement('div')
  toolbar.id = HUB_TOOLBAR_ID
  toolbar.style.top = `${sticksAt}px`
  Object.defineProperty(toolbar, 'offsetTop', {
    configurable: true,
    value: flowTop
  })
  toolbar.getBoundingClientRect = () => ({
    x: 0,
    y: paintedTop,
    top: paintedTop,
    bottom: paintedTop,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({})
  })
  document.body.append(toolbar)
  return toolbar
}

interface Navigation {
  from?: string
  to?: string
  direction?: string
  navigationType?: string
}

function startNavigation({
  from = routes.hubWorkflows,
  to = routes.hubApps,
  direction = 'forward',
  navigationType = 'push'
}: Navigation = {}) {
  document.dispatchEvent(
    Object.assign(new Event('astro:before-preparation'), {
      from: new URL(from, ORIGIN),
      to: new URL(to, ORIGIN),
      direction,
      navigationType,
      loader: async () => undefined
    })
  )
}

function finishNavigation() {
  document.dispatchEvent(new Event('astro:after-swap'))
}

type Registration = Parameters<typeof document.addEventListener>

const register = document.addEventListener.bind(document)
const registrations: Registration[] = []

/**
 * Every import registers another set of listeners on the one document the file
 * shares, so each test's listeners are tracked and taken off again afterwards.
 */
async function loadHubNavigation() {
  vi.resetModules()
  await import('./hubNavigation')
}

describe('hubNavigation', () => {
  let scrollTo: ReturnType<typeof stubScrollTo>
  let resizes: FakeObserver[]
  let mutations: FakeObserver[]

  beforeEach(() => {
    page.scrollHeight = TALL_PAGE
    page.innerHeight = VIEWPORT
    page.scrollY = 0
    scrollTo = stubScrollTo()
    resizes = stubObserver('ResizeObserver')
    mutations = stubObserver('MutationObserver')
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (...registration: Registration) => {
        registrations.push(registration)
        register(...registration)
      }
    )
  })

  afterEach(() => {
    for (const [type, listener, options] of registrations)
      document.removeEventListener(type, listener, options)
    registrations.length = 0
  })

  it('scrolls the toolbar back to its sticky offset after a hub tab swap', async () => {
    await loadHubNavigation()
    addToolbar()

    startNavigation()
    finishNavigation()

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, PINNED_SCROLL)
    // The pin landed, so no wait was ever started.
    expect(resizes).toHaveLength(0)
    expect(mutations).toHaveLength(0)
  })

  it('scrolls to the top rather than past it when the toolbar starts above its own offset', async () => {
    await loadHubNavigation()
    addToolbar({ flowTop: 40 })

    startNavigation()
    finishNavigation()

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it('does not move a page too short to hold the scroll, and keeps waiting', async () => {
    page.scrollHeight = SHORT_PAGE
    await loadHubNavigation()
    addToolbar()

    startNavigation()
    finishNavigation()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(page.scrollY).toBe(0)
    expect(resizes[0].connected).toBe(true)
    expect(resizes[0].targets).toStrictEqual([document.documentElement])
    expect(mutations[0].connected).toBe(true)
    expect(mutations[0].targets).toStrictEqual([document.body])
  })

  it('pins once the page has grown tall enough, and stops watching', async () => {
    page.scrollHeight = SHORT_PAGE
    await loadHubNavigation()
    addToolbar()
    startNavigation()
    finishNavigation()

    page.scrollHeight = TALL_PAGE
    resizes[0].fire()

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, PINNED_SCROLL)
    expect(resizes[0].connected).toBe(false)
    expect(mutations[0].connected).toBe(false)

    resizes[0].fire()
    mutations[0].fire()
    vi.advanceTimersByTime(PIN_TIMEOUT_MS)

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pins once the swapped-in toolbar mounts, and stops watching', async () => {
    await loadHubNavigation()
    const toolbar = addToolbar()
    startNavigation()
    toolbar.remove()
    finishNavigation()

    expect(scrollTo).not.toHaveBeenCalled()

    addToolbar()
    mutations[0].fire()

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, PINNED_SCROLL)
    expect(resizes[0].connected).toBe(false)
    expect(mutations[0].connected).toBe(false)

    mutations[0].fire()

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('stops watching when the pin has not landed by the timeout', async () => {
    page.scrollHeight = SHORT_PAGE
    await loadHubNavigation()
    addToolbar()
    startNavigation()
    finishNavigation()

    vi.advanceTimersByTime(PIN_TIMEOUT_MS - 1)

    expect(resizes[0].connected).toBe(true)
    expect(mutations[0].connected).toBe(true)

    vi.advanceTimersByTime(1)

    expect(resizes[0].connected).toBe(false)
    expect(mutations[0].connected).toBe(false)

    // The page is now long enough to pin, so a wait still running would move it.
    page.scrollHeight = TALL_PAGE
    resizes[0].fire()
    mutations[0].fire()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it.for(['wheel', 'touchmove'])(
    'stops watching when the reader takes the page somewhere with %s',
    async (reader) => {
      page.scrollHeight = SHORT_PAGE
      await loadHubNavigation()
      addToolbar()
      startNavigation()
      finishNavigation()

      document.dispatchEvent(new Event(reader))

      expect(resizes[0].connected).toBe(false)
      expect(mutations[0].connected).toBe(false)

      page.scrollHeight = TALL_PAGE
      resizes[0].fire()
      mutations[0].fire()

      expect(scrollTo).not.toHaveBeenCalled()
    }
  )

  // A tab is a link: Enter follows it, Space scrolls past it. Both reach this
  // listener, and only one of them means the reader is leaving.
  it.for([' ', 'PageDown', 'ArrowDown', 'Home', 'End'])(
    'stops watching when the reader scrolls the page with %s',
    async (key) => {
      page.scrollHeight = SHORT_PAGE
      await loadHubNavigation()
      addToolbar()
      startNavigation()
      finishNavigation()

      document.dispatchEvent(new KeyboardEvent('keydown', { key }))

      expect(resizes[0].connected).toBe(false)
      expect(mutations[0].connected).toBe(false)

      page.scrollHeight = TALL_PAGE
      resizes[0].fire()
      mutations[0].fire()

      expect(scrollTo).not.toHaveBeenCalled()
    }
  )

  it.for(['Enter', 'Tab', 'a'])(
    'keeps waiting through %s, which does not scroll the page',
    async (key) => {
      page.scrollHeight = SHORT_PAGE
      await loadHubNavigation()
      addToolbar()
      startNavigation()
      finishNavigation()

      document.dispatchEvent(new KeyboardEvent('keydown', { key }))

      expect(resizes[0].connected).toBe(true)
      expect(mutations[0].connected).toBe(true)

      page.scrollHeight = TALL_PAGE
      resizes[0].fire()

      expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, PINNED_SCROLL)
    }
  )

  it('stops watching when the next navigation starts', async () => {
    page.scrollHeight = SHORT_PAGE
    await loadHubNavigation()
    addToolbar()
    startNavigation()
    finishNavigation()

    startNavigation({ from: routes.hubApps, to: routes.hubWorkflows })

    expect(resizes[0].connected).toBe(false)
    expect(mutations[0].connected).toBe(false)

    page.scrollHeight = TALL_PAGE
    resizes[0].fire()
    mutations[0].fire()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves Back and Forward to the history entry they restore', async () => {
    await loadHubNavigation()
    addToolbar()

    startNavigation({ navigationType: 'traverse' })
    finishNavigation()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(resizes).toHaveLength(0)
    expect(mutations).toHaveLength(0)
  })

  it('does not hold the toolbar for a navigation that leaves the hub', async () => {
    await loadHubNavigation()
    addToolbar()

    startNavigation({ from: routes.hubApps, to: routes.pricing })
    finishNavigation()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(resizes).toHaveLength(0)
    expect(mutations).toHaveLength(0)
  })

  it('does not hold a toolbar that was still in flow when the reader left', async () => {
    await loadHubNavigation()
    addToolbar({ paintedTop: STICKY_OFFSET + 100 })

    startNavigation()
    finishNavigation()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(resizes).toHaveLength(0)
    expect(mutations).toHaveLength(0)
  })
})
