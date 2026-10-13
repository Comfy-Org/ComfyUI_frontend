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

  it.for([
    { columns: undefined, gridClass: 'md:grid-cols-2' },
    { columns: 3 as const, gridClass: 'md:grid-cols-3' }
  ])('lays the cards out in columns=$columns', ({ columns, gridClass }) => {
    render(ModelLaunchGallerySection, {
      props: { gallery: { ...gallery, columns } }
    })

    expect(screen.getByTestId('model-launch-gallery-grid')).toHaveClass(
      gridClass
    )
  })

  it('stretches a full-span card across the row at a 3:1 ratio on desktop', () => {
    const [first, second] = gallery.cards
    render(ModelLaunchGallerySection, {
      props: {
        gallery: { ...gallery, cards: [first, { ...second, span: 'full' }] }
      }
    })
    const [plain, featured] = screen.getAllByRole('article')

    const [plainMedia, featuredMedia] =
      screen.getAllByTestId('gallery-card-media')

    expect(plain).not.toHaveClass('md:col-span-full')
    expect(featured).toHaveClass('md:col-span-full')
    expect(plainMedia).toHaveClass('aspect-19/10')
    expect(featuredMedia).toHaveClass('md:aspect-3/1')
  })

  it('overlays the caption on a square tile when captionPlacement is overlay', () => {
    render(ModelLaunchGallerySection, {
      props: { gallery: { ...gallery, captionPlacement: 'overlay' } }
    })
    const [media] = screen.getAllByTestId('gallery-card-media')

    expect(media).toHaveClass('aspect-square')
    expect(screen.getByTestId('model-launch-gallery-grid')).toHaveClass('gap-2')
    expect(screen.getAllByText('One.')).toHaveLength(1)
    expect(screen.getByText('One.')).toHaveClass('absolute')
  })

  it('opens an expandable image full screen when its tile is clicked', async () => {
    const [first, second] = gallery.cards
    render(ModelLaunchGallerySection, {
      props: {
        gallery: { ...gallery, cards: [first, { ...second, expandable: true }] }
      }
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Fullscreen' })).toHaveLength(
      1
    )
    expect(screen.getAllByTestId('gallery-card-expand')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Fullscreen' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getAllByAltText('Second render')).toHaveLength(2)
  })

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
