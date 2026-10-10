// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { draftCardStates, markDraftCards } from './draft-card-marks'

const changes = [
  { id: '1', title: 'A', change: 'new' as const, slug: '/hub/models/a' },
  { id: '2', title: 'B', change: 'updated' as const, slug: '/hub/models/b' },
  {
    id: '3',
    title: 'C',
    change: 'updated' as const,
    slug: '/hub/models/c',
    visibleFrom: '2999-01-01T00:00:00Z'
  },
  { id: '4', title: 'D', change: 'removed' as const, slug: '/hub/models/d' }
]

describe('draft card marks', () => {
  it('tells new, changed and scheduled pages apart and skips removals', () => {
    expect(Object.fromEntries(draftCardStates(changes))).toEqual({
      '/hub/models/a': 'new',
      '/hub/models/b': 'updated',
      '/hub/models/c': 'scheduled'
    })
  })

  it('labels matching cards and links once, in either language', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <a data-testid="workshop-model-card" href="/zh-CN/hub/models/a/"><div class="relative"></div></a>
      <a data-testid="workshop-model-card" href="/hub/models/z/"><div class="relative"></div></a>
      <a href="/hub/models/b/">B</a>
      <div role="dialog"><a href="/hub/models/b">B</a></div>`
    const stop = markDraftCards(root, changes, (state) => state.toUpperCase())
    markDraftCards(root, changes, (state) => state.toUpperCase())
    const [marked, untouched, link, inDialog] = root.querySelectorAll('a')
    expect(marked.getAttribute('data-draft-mark')).toBe('new')
    expect(marked.querySelectorAll('span')).toHaveLength(1)
    expect(marked.textContent).toBe('NEW')
    expect(untouched.hasAttribute('data-draft-mark')).toBe(false)
    expect(link.textContent).toBe('BUPDATED')
    expect(inDialog.textContent).toBe('B')
    stop()
  })
})
