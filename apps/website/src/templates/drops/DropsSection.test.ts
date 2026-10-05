import { render, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { Drop } from '@/data/drops'
import DropsSection from './DropsSection.vue'

function drop(overrides: Partial<Drop> & { id: string }): Drop {
  return {
    launchDate: '2026-06-26',
    category: { en: 'Platform', 'zh-CN': '平台' },
    media: {
      type: 'image',
      src: 'https://example.com/a.jpg',
      alt: { en: 'Alt', 'zh-CN': '替代文本' }
    },
    title: { en: 'Title', 'zh-CN': '标题' },
    description: { en: 'Description', 'zh-CN': '描述' },
    cta: {
      label: { en: 'EXPLORE', 'zh-CN': '探索' },
      href: { en: '/x/', 'zh-CN': '/zh-CN/x/' }
    },
    ...overrides
  }
}

const { recentDrop, staleDrop, overriddenDrop } = vi.hoisted(() => ({
  recentDrop: {
    id: 'recent-drop',
    launchDate: '2026-09-25',
    title: { en: 'Recent Drop', 'zh-CN': '最新发布' }
  },
  staleDrop: {
    id: 'stale-drop',
    launchDate: '2026-06-26',
    title: { en: 'Stale Drop', 'zh-CN': '旧发布' }
  },
  overriddenDrop: {
    id: 'overridden-drop',
    launchDate: '2026-01-01',
    badge: { en: 'BETA', 'zh-CN': 'BETA' },
    title: { en: 'Overridden Drop', 'zh-CN': '手动标记发布' }
  }
}))

// Deliberately out of launchDate order, oldest first, so a passing display-
// order test can only mean the component sorted — not that the fixture
// happened to already be in the right order.
vi.mock(import('@/data/drops'), () => ({
  NEW_BADGE: { en: 'NEW', 'zh-CN': '新' },
  isRecentLaunch: (launchDate: string) => launchDate === recentDrop.launchDate,
  drops: [drop(overriddenDrop), drop(staleDrop), drop(recentDrop)]
}))

function cards(container: Element) {
  // Card has no accessible role; it's the only way to scope a badge check
  // to one item among several otherwise-identical cards.
  return container.querySelectorAll<HTMLElement>('[data-slot="card"]')
}

describe('DropsSection order', () => {
  it('renders drops newest launchDate first, regardless of data-file order', () => {
    const { container } = render(DropsSection, { props: { locale: 'en' } })

    const titles = Array.from(cards(container)).map(
      (card) => within(card).getByText(/Drop$/).textContent
    )
    expect(titles).toEqual(['Recent Drop', 'Stale Drop', 'Overridden Drop'])
  })
})

describe('DropsSection badge', () => {
  it('shows a computed NEW badge for a drop launched within the window', () => {
    const { container } = render(DropsSection, { props: { locale: 'en' } })

    const [recentCard] = cards(container)
    expect(within(recentCard).getByText('NEW')).toBeInTheDocument()
  })

  it('shows no badge for a drop whose launchDate is outside the window', () => {
    const { container } = render(DropsSection, { props: { locale: 'en' } })

    const [, staleCard] = cards(container)
    expect(within(staleCard).queryByText('NEW')).not.toBeInTheDocument()
    expect(within(staleCard).queryByText('BETA')).not.toBeInTheDocument()
  })

  it('prefers a manual badge override over the computed one, localized', () => {
    const { container } = render(DropsSection, { props: { locale: 'zh-CN' } })

    const [, , overriddenCard] = cards(container)
    expect(within(overriddenCard).getByText('BETA')).toBeInTheDocument()
    expect(within(overriddenCard).queryByText('新')).not.toBeInTheDocument()
  })
})
