import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ModelLaunchGallery } from './types'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import ModelLaunchGallerySection from './ModelLaunchGallerySection.vue'

const gallery: ModelLaunchGallery = {
  headingKey: 'nvidiaRtx.gallery.heading',
  cards: [
    {
      id: 'one',
      name: { en: 'First render', 'zh-CN': '第一幅' },
      tier: 'free',
      note: { en: 'Runs locally', 'zh-CN': '本地运行' },
      description: { en: 'One.', 'zh-CN': '一。' },
      media: { kind: 'image', src: '/one.webp' },
      href: 'https://comfy.org/download/'
    },
    {
      id: 'two',
      name: { en: 'Second render', 'zh-CN': '第二幅' },
      tier: 'free',
      note: { en: 'Runs locally', 'zh-CN': '本地运行' },
      description: { en: 'Two.', 'zh-CN': '二。' },
      media: { kind: 'image', src: '/two.webp' },
      href: 'https://comfy.org/download/'
    }
  ]
}

describe('ModelLaunchGallerySection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it.for([
    { ctaVariant: undefined, cardMeta: undefined, links: 2, notes: 2 },
    { ctaVariant: 'accent' as const, cardMeta: undefined, links: 2, notes: 2 },
    { ctaVariant: 'none' as const, cardMeta: undefined, links: 0, notes: 2 },
    { ctaVariant: undefined, cardMeta: 'none' as const, links: 2, notes: 0 },
    {
      ctaVariant: 'none' as const,
      cardMeta: 'none' as const,
      links: 0,
      notes: 0
    }
  ])(
    'renders $links card links and $notes notes for ctaVariant=$ctaVariant cardMeta=$cardMeta',
    ({ ctaVariant, cardMeta, links, notes }) => {
      render(ModelLaunchGallerySection, {
        props: { gallery: { ...gallery, ctaVariant, cardMeta } }
      })

      expect(screen.queryAllByRole('link')).toHaveLength(links)
      expect(screen.queryAllByText('Runs locally')).toHaveLength(notes)
      expect(screen.queryAllByText('Free')).toHaveLength(notes)
      expect(screen.getByText('One.')).toBeVisible()
    }
  )

  it('collapses cards past the mobile limit until Load more is pressed', async () => {
    const user = userEvent.setup()
    render(ModelLaunchGallerySection, {
      props: { gallery: { ...gallery, mobileVisibleCards: 1 } }
    })
    const [first, second] = screen.getAllByRole('article')

    expect(first).not.toHaveClass('hidden')
    expect(second).toHaveClass('hidden', 'md:block')

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(second).not.toHaveClass('hidden')
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('offers no Load more when every card already fits the mobile limit', () => {
    render(ModelLaunchGallerySection, {
      props: { gallery: { ...gallery, mobileVisibleCards: 2 } }
    })

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    for (const article of screen.getAllByRole('article')) {
      expect(article).not.toHaveClass('hidden')
    }
  })
})
