// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CardArticleItem } from './CardArticle01.vue'

import CardArticle01 from './CardArticle01.vue'

function makeItem(overrides: Partial<CardArticleItem> = {}): CardArticleItem {
  return {
    id: 'sample-card',
    category: 'Workshop',
    title: 'Sample Card',
    cta: { label: 'Learn more', href: '/sample' },
    ...overrides
  }
}

const mediaStandIn = (root: Element) =>
  // eslint-disable-next-line testing-library/no-node-access
  root.querySelector('.aspect-video > div[aria-hidden="true"]')

// CardArrow is decorative (aria-hidden), so it has no accessible query.
const cardArrow = (root: Element) =>
  // eslint-disable-next-line testing-library/no-node-access
  root.querySelector('[data-slot="card-footer"] [aria-hidden="true"]')

describe('CardArticle01', () => {
  it('renders image media as an img', () => {
    render(CardArticle01, {
      props: {
        item: makeItem({
          media: {
            type: 'image',
            src: 'https://example.com/art.jpg',
            alt: 'Card art'
          }
        })
      }
    })

    expect(
      screen.getByRole('img', { name: 'Card art' }).getAttribute('src')
    ).toBe('https://example.com/art.jpg')
  })

  it('renders video media as a looping clip with its poster', () => {
    const { container } = render(CardArticle01, {
      props: {
        item: makeItem({
          media: {
            type: 'video',
            src: 'https://example.com/clip.mp4',
            alt: 'Card clip',
            poster: 'https://example.com/poster.jpg'
          }
        })
      }
    })

    // <video> has no queryable role in happy-dom, so reach it directly.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const video = container.querySelector('video')
    expect(video?.getAttribute('src')).toBe('https://example.com/clip.mp4')
    expect(video?.getAttribute('poster')).toBe('https://example.com/poster.jpg')
    expect(video?.getAttribute('aria-label')).toBe('Card clip')
  })

  it('fills an artless card with a decorative stand-in instead of media', () => {
    const { container } = render(CardArticle01, { props: { item: makeItem() } })

    expect(mediaStandIn(container)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('video')).toBeNull()
  })

  it('drops the arrow affordance from an author card that has no CTA', async () => {
    const author = { name: 'Ada Lovelace', avatarSrc: '/ada.jpg' }
    const { container, rerender } = render(CardArticle01, {
      props: { item: makeItem({ author }) }
    })

    expect(cardArrow(container)).toBeTruthy()

    await rerender({ item: makeItem({ author, cta: undefined }) })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(cardArrow(container)).toBeNull()
  })

  it('opens the card link in a new tab when the CTA asks for one', () => {
    render(CardArticle01, {
      props: {
        item: makeItem({
          cta: { label: 'Register', href: 'https://example.com', newTab: true }
        })
      }
    })

    const link = screen.getByRole('link', { name: 'Sample Card — Register' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
