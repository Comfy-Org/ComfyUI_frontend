import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { GalleryItem } from '../../data/gallery'
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

  it('stays hidden without posts', () => {
    render(ExploreCommunity, { props: { items: [] } })

    expect(screen.queryByTestId('explore-community')).not.toBeInTheDocument()
  })
})
