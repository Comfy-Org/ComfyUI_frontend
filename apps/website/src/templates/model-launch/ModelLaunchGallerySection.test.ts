import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ModelLaunchGallery } from './types'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
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
    { captionPlacement: undefined, insideTile: 0 },
    { captionPlacement: 'overlay' as const, insideTile: 1 }
  ])(
    'renders the caption once, $insideTile time(s) inside the tile, for captionPlacement=$captionPlacement',
    ({ captionPlacement, insideTile }) => {
      render(ModelLaunchGallerySection, {
        props: { gallery: { ...gallery, captionPlacement } }
      })
      const [tile] = screen.getAllByTestId('gallery-card-media')

      expect(screen.getAllByText('One.')).toHaveLength(1)
      expect(within(tile).queryAllByText('One.')).toHaveLength(insideTile)
    }
  )

  it('opens an expandable image full screen and closes it on Escape', async () => {
    const user = userEvent.setup()
    const [first, second] = gallery.cards
    render(ModelLaunchGallerySection, {
      props: {
        gallery: { ...gallery, cards: [first, { ...second, expandable: true }] }
      }
    })

    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }))

    expect(
      within(screen.getByRole('dialog')).getByRole('img', {
        name: 'Second render'
      })
    ).toBeVisible()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('offers no full screen button for an expandable video card', () => {
    const [first] = gallery.cards
    render(ModelLaunchGallerySection, {
      props: {
        gallery: {
          ...gallery,
          cards: [
            {
              ...first,
              expandable: true,
              media: { kind: 'video', src: '/one.mp4' }
            }
          ]
        }
      }
    })

    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull()
  })
})
