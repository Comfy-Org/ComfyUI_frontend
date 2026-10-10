import type { DraftPageChange } from './format'
import { isFuture } from './format'

export type DraftCardState = 'new' | 'updated' | 'scheduled'

const MARK = 'data-draft-mark'

// Literal class lists so Tailwind keeps them; the marks are added to cards
// the public site renders, which never use these tokens themselves.
const chipClass: Record<DraftCardState, string> = {
  new: 'bg-admin-success text-admin-page',
  updated: 'bg-admin-info text-admin-page',
  scheduled: 'bg-admin-warning text-admin-page'
}
const ringClass: Record<DraftCardState, string[]> = {
  new: ['ring-2', 'ring-admin-success'],
  updated: ['ring-2', 'ring-admin-info'],
  scheduled: ['ring-2', 'ring-admin-warning']
}

const pagePath = (href: string) =>
  new URL(href, 'https://comfy.org').pathname
    .replace(/^\/zh-CN(?=\/)/, '')
    .replace(/\/$/, '')

export function draftCardStates(changes: DraftPageChange[]) {
  const states = new Map<string, DraftCardState>()
  for (const change of changes) {
    if (change.change === 'removed') continue
    states.set(
      pagePath(change.slug),
      isFuture(change.visibleFrom)
        ? 'scheduled'
        : change.change === 'new'
          ? 'new'
          : 'updated'
    )
  }
  return states
}

/**
 * Labels the Hub cards and links the draft adds or changes, so a reviewer browsing the
 * preview sees what is new without opening the changes list. Cards render
 * after the catalogue island loads, so it keeps watching the page.
 */
export function markDraftCards(
  root: HTMLElement,
  changes: DraftPageChange[],
  label: (state: DraftCardState) => string
) {
  const states = draftCardStates(changes)
  if (states.size === 0) return () => {}
  const chip = (state: DraftCardState, placement: string) => {
    const element = document.createElement('span')
    element.className = `pointer-events-none rounded-full px-2 py-0.5 font-admin text-xs font-medium ${placement} ${chipClass[state]}`
    element.textContent = label(state)
    return element
  }
  const mark = () => {
    for (const link of root.querySelectorAll<HTMLAnchorElement>(
      `a[href]:not([${MARK}])`
    )) {
      if (link.closest('[role="dialog"], [data-cms-preview-bar]')) continue
      const state = states.get(pagePath(link.getAttribute('href') ?? ''))
      if (!state) continue
      link.setAttribute(MARK, state)
      if (link.dataset.testid === 'workshop-model-card') {
        link.classList.add(...ringClass[state])
        const media = link.querySelector(':scope > .relative') ?? link
        media.append(
          chip(state, 'absolute top-3 left-1/2 z-20 -translate-x-1/2')
        )
      } else link.append(chip(state, 'ml-2 inline-block align-middle'))
    }
  }
  mark()
  const observer = new MutationObserver(mark)
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}
