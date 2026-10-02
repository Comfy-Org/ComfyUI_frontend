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

function pinToolbar() {
  const target = pinnedScroll()
  if (target === undefined) return false
  window.scrollTo(0, target)
  return Math.round(window.scrollY) === Math.round(target)
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
  const sticky = stickyToolbar()
  // Back and forward restore their own scroll, so only a tab click carries one.
  toolbarWasPinned =
    hub &&
    event.direction === 'forward' &&
    sticky !== undefined &&
    sticky.toolbar.getBoundingClientRect().top <= sticky.offset + 1

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
  if (pinToolbar()) return
  // The incoming listing renders after the swap: until it does there is no
  // toolbar to pin and the page can be too short to hold the scroll.
  const growing = new ResizeObserver(() => {
    if (pinToolbar()) growing.disconnect()
  })
  growing.observe(document.documentElement)
  document.addEventListener(
    'astro:before-preparation',
    () => growing.disconnect(),
    {
      once: true
    }
  )
})
