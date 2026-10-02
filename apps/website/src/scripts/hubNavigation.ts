import { getRoutes } from '../config/routes'
import {
  loadAppCatalogue,
  loadWorkflowCatalogue
} from '../lib/workshop/catalogue-components'

import { HUB_TOOLBAR_ID } from './hubToolbar'

const routes = getRoutes('en')
const catalogues: Readonly<
  Record<string, (() => Promise<unknown>) | undefined>
> = {
  [routes.workshop]: undefined,
  [routes.hubWorkflows]: loadWorkflowCatalogue,
  [routes.hubApps]: loadAppCatalogue
}

const TOOLBAR = `#${HUB_TOOLBAR_ID}`

/**
 * The catalogue toolbar sticks under the header once the page scrolls past it.
 * Pinned, its distance from the top of the window is its own `top`.
 */
function stickyToolbar() {
  const toolbar = document.querySelector<HTMLElement>(TOOLBAR)
  if (!toolbar) return undefined
  const offset = Number.parseFloat(getComputedStyle(toolbar).top)
  return Number.isFinite(offset) ? { toolbar, offset } : undefined
}

/** Where the page has to sit for the toolbar to be pinned rather than in flow. */
function pinnedScroll() {
  const sticky = stickyToolbar()
  if (!sticky) return undefined
  let top = 0
  // Sticky clamps the painted box, so the flow position is what can be read
  // the same whether the page is already scrolled or not.
  for (
    let node: HTMLElement | null = sticky.toolbar;
    node;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
  )
    top += node.offsetTop
  return top - sticky.offset
}

/** Whether the toolbar is stuck under the header rather than sitting in flow. */
function toolbarIsPinned() {
  const sticky = stickyToolbar()
  return (
    sticky !== undefined &&
    sticky.toolbar.getBoundingClientRect().top <= sticky.offset + 1
  )
}

function pinToolbar() {
  const target = pinnedScroll()
  if (target === undefined) return false
  // A toolbar whose flow position is already above its own sticky offset is
  // pinned wherever the page stands, and a scroll offset snaps to a device
  // pixel, so the landing is read with a pixel of slack rather than exactly.
  const reachable = Math.max(target, 0)
  const room = Math.max(
    document.documentElement.scrollHeight - window.innerHeight,
    0
  )
  // A page with no room for the scroll would only take part of it and leave
  // the reader somewhere they did not ask to be. It may still be growing, so
  // the wait goes on, but nothing moves under them while it does.
  if (reachable > room) return false
  window.scrollTo(0, reachable)
  return Math.abs(window.scrollY - reachable) <= 1
}

// The incoming listing renders after the swap: until it does there is no
// toolbar to pin, and the page can be too short to hold the scroll. One
// observer waits for it to arrive, the other for the page to grow under it.
// A listing that fails to load, or one too short to hold the scroll, would
// leave them watching every mutation for the life of the page, so the wait
// ends either way: on the next navigation, on time, or on the reader taking
// the page somewhere themselves — which is a scroll, never the tap or the
// keystroke that worked the tab in the first place.
const PIN_TIMEOUT_MS = 3000
const READER_SCROLLS = ['wheel', 'touchmove']
// Enter and Space work the tab itself, so only the keys that scroll end the
// wait: a reader on a keyboard gets out of it the same way a reader on a
// wheel does. A drag of the scrollbar still does not, having no event of its
// own that the pin's own scrolling could be told apart from.
const SCROLL_KEYS = new Set([
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End'
])

function pinWhenReady() {
  const growing = new ResizeObserver(() => retry())
  const mounting = new MutationObserver(() => retry())
  const waiting = new AbortController()
  const deadline = setTimeout(stop, PIN_TIMEOUT_MS)
  function stop() {
    clearTimeout(deadline)
    growing.disconnect()
    mounting.disconnect()
    waiting.abort()
  }
  function retry() {
    if (pinToolbar()) stop()
  }
  growing.observe(document.documentElement)
  mounting.observe(document.body, { childList: true, subtree: true })
  for (const reader of READER_SCROLLS)
    document.addEventListener(reader, stop, {
      signal: waiting.signal,
      passive: true
    })
  document.addEventListener(
    'keydown',
    (event) => {
      if (SCROLL_KEYS.has(event.key)) stop()
    },
    { signal: waiting.signal, passive: true }
  )
  document.addEventListener('astro:before-preparation', stop, {
    signal: waiting.signal
  })
}

/**
 * A link the reader followed, rather than a history entry the browser restores
 * the scroll for itself. Forward reads as a forward direction too, so the kind
 * of navigation is what tells them apart.
 */
function followsALink(event: { direction: string; navigationType: string }) {
  return event.direction === 'forward' && event.navigationType !== 'traverse'
}

let toolbarWasPinned = false

function isHubNavigation(from: URL, to: URL) {
  return (
    from.origin === to.origin &&
    Object.hasOwn(catalogues, from.pathname) &&
    Object.hasOwn(catalogues, to.pathname)
  )
}

document.addEventListener('astro:before-preparation', (event) => {
  const hub = isHubNavigation(event.from, event.to)
  toolbarWasPinned = hub && followsALink(event) && toolbarIsPinned()

  if (!hub) return
  const prepare = event.loader
  event.loader = async () => {
    await Promise.all([
      prepare(),
      catalogues[event.to.pathname]?.().catch(() => undefined)
    ])
  }
})

document.addEventListener('astro:before-swap', (event) => {
  if (
    !isHubNavigation(event.from, event.to) ||
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  void event.viewTransition.ready.catch(() => undefined)
  event.viewTransition.skipTransition()
})

// A tab swaps the listing under a control the reader just clicked, so the
// control stays where it was and the new listing starts beneath it. Restoring
// the old scroll instead would land in the middle of a listing of another
// length; the top of the page would move the tabs out from under the pointer.
document.addEventListener('astro:after-swap', () => {
  if (!toolbarWasPinned) return
  toolbarWasPinned = false
  if (!pinToolbar()) pinWhenReady()
})
