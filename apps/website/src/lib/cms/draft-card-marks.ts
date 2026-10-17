import type { CatalogPreviewChange } from './preview-display'
import { withoutCatalogLocalePrefix } from '@/config/catalog-locales'

export type DraftCardState = 'new' | 'updated' | 'scheduled'
const ring: Record<DraftCardState, string[]> = {
  new: ['ring-2', 'ring-admin-success'],
  updated: ['ring-2', 'ring-admin-info'],
  scheduled: ['ring-2', 'ring-admin-warning']
}
const chip: Record<DraftCardState, string> = {
  new: 'bg-admin-success text-admin-page',
  updated: 'bg-admin-info text-admin-page',
  scheduled: 'bg-admin-warning text-admin-page'
}
function pagePath(href: string, origin: string) {
  try {
    const url = new URL(href, origin)
    if (url.origin !== origin) return
    const path = withoutCatalogLocalePrefix(url.pathname).replace(/\/$/, '')
    return /^\/hub\/(?:models|workflows|apps)\/[^/]+$/.test(path)
      ? path
      : undefined
  } catch {
    return
  }
}

// Mar's card treatment, applied only by the verified Draft controller. A public
// card's real href remains unchanged; these annotations confer no access.
export function markDraftCards(
  root: HTMLElement,
  changes: readonly CatalogPreviewChange[],
  label: (state: DraftCardState) => string,
  now = Date.now()
) {
  const origin = root.ownerDocument.location.origin
  const states = new Map<string, DraftCardState>()
  for (const change of changes) {
    if (change.kind === 'deleted' || !change.pagePath) continue
    const path = pagePath(change.pagePath, origin)
    if (!path) continue
    const scheduled = change.visibleFrom && Date.parse(change.visibleFrom) > now
    states.set(
      path,
      scheduled ? 'scheduled' : change.kind === 'added' ? 'new' : 'updated'
    )
  }
  const marks = new Map<HTMLElement, { badge: HTMLElement; added: string[] }>()
  function mark() {
    for (const card of root.querySelectorAll<HTMLAnchorElement>(
      'a[data-testid="workshop-model-card"][href]'
    )) {
      if (marks.has(card)) continue
      const path = pagePath(card.href, origin)
      const state = path && states.get(path)
      if (!state) continue
      const badge = root.ownerDocument.createElement('span')
      badge.textContent = label(state)
      badge.className = `pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-2 py-0.5 font-admin text-xs font-medium ${chip[state]}`
      const added = ring[state].filter(
        (value) => !card.classList.contains(value)
      )
      card.classList.add(...added)
      card.dataset.draftMark = state
      const media = card.querySelector(':scope > .relative') ?? card
      media.append(badge)
      marks.set(card, { badge, added })
    }
  }
  if (states.size) mark()
  const observer = new MutationObserver(mark)
  if (states.size) observer.observe(root, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    for (const [card, { badge, added }] of marks) {
      badge.remove()
      card.classList.remove(...added)
      delete card.dataset.draftMark
    }
  }
}
