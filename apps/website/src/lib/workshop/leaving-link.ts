/**
 * The address a click is about to follow, when it is the plain in-site
 * navigation a page can answer for itself: a left click with no modifier, on a
 * link to another page of this origin that the client router would otherwise
 * swap in. Anything else is left to the browser and to the guards around it.
 */
export function linkLeavingPage(
  event: MouseEvent,
  here: Pick<Location, 'origin' | 'href'>
): string | undefined {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target
  const link = target instanceof Element ? target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement)) return
  if (link.hasAttribute('download')) return
  if (link.target && link.target !== '_self') return
  if (link.origin !== here.origin) return
  const current = new URL(here.href)
  if (
    link.pathname === current.pathname &&
    link.search === current.search &&
    link.hash !== current.hash
  )
    return
  if (link.href === here.href) return
  return link.href
}
