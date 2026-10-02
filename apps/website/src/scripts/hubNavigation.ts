import { getRoutes } from '../config/routes'
import {
  loadAppCatalogue,
  loadWorkflowCatalogue
} from '../lib/workshop/catalogue-components'

const routes = getRoutes('en')
const catalogues: Readonly<
  Record<string, (() => Promise<unknown>) | undefined>
> = {
  [routes.workshop]: undefined,
  [routes.hubWorkflows]: loadWorkflowCatalogue,
  [routes.hubApps]: loadAppCatalogue
}

const TOOLBAR = '#hub-toolbar'

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
  window.scrollTo(0, target)
  return Math.round(window.scrollY) === Math.round(target)
}

// The incoming listing renders after the swap: until it does there is no
// toolbar to pin, and the page can be too short to hold the scroll. One
// observer waits for it to arrive, the other for the page to grow under it.
function pinWhenReady() {
  const growing = new ResizeObserver(() => retry())
  const mounting = new MutationObserver(() => retry())
  const stop = () => {
    growing.disconnect()
    mounting.disconnect()
  }
  function retry() {
    if (pinToolbar()) stop()
  }
  growing.observe(document.documentElement)
  mounting.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('astro:before-preparation', stop, { once: true })
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
  // Back and Forward restore their own scroll, and Forward reads as a forward
  // direction too, so the kind of navigation is what tells a click apart.
  toolbarWasPinned =
    hub &&
    event.direction === 'forward' &&
    event.navigationType !== 'traverse' &&
    toolbarIsPinned()

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
