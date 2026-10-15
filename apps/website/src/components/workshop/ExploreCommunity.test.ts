import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks } from '@/config/routes'
import type { GalleryItem } from '@/data/gallery'
import ExploreCommunity from './ExploreCommunity.vue'

const post = (overrides: Partial<GalleryItem>): GalleryItem => ({
  id: 'post',
  title: 'Post',
  userAlias: 'someone',
  teamAlias: '',
  tool: 'ComfyUI',
  ...overrides
})

describe('ExploreCommunity', () => {
  it('shows a still post as its image', () => {
    render(ExploreCommunity, {
      props: { items: [post({ image: 'https://media.test/still.webp' })] }
    })

    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://media.test/still.webp'
    )
  })

  it('links a post to its creator in a new tab, never to the retired gallery', () => {
    render(ExploreCommunity, {
      props: {
        items: [
          post({
            id: 'linked',
            image: 'a.webp',
            href: 'https://creator.test/'
          }),
          post({ id: 'plain', image: 'b.webp' })
        ]
      }
    })

    expect(
      screen
        .getAllByRole('link')
        .map((link) => [link.getAttribute('href'), link.getAttribute('target')])
    ).toEqual([
      [externalLinks.gallerySubmit, '_blank'],
      ['https://creator.test/', '_blank']
    ])
  })

  it('stays hidden without posts', () => {
    render(ExploreCommunity, { props: { items: [] } })

    expect(screen.queryByTestId('explore-community')).not.toBeInTheDocument()
  })
})
