import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { NavFeatured } from '../../../data/mainNavigation'
import NavFeaturedCard from './NavFeaturedCard.vue'

const featured: NavFeatured = {
  imageSrc: 'https://example.com/poster.webp',
  imageAlt: 'Featured clip',
  title: 'New release',
  cta: { label: 'Explore', href: '/launch' }
}

describe('NavFeaturedCard', () => {
  it('renders the image when no video is set', () => {
    render(NavFeaturedCard, { props: { featured } })
    expect(
      screen.getByRole('img', { name: 'Featured clip' }).getAttribute('src')
    ).toBe(featured.imageSrc)
  })

  it('plays the video with the image as its poster when a video is set', () => {
    render(NavFeaturedCard, {
      props: {
        featured: { ...featured, videoSrc: 'https://example.com/clip.webm' }
      }
    })
    const video = screen.getByLabelText('Featured clip')
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('src')).toBe('https://example.com/clip.webm')
    expect(video.getAttribute('poster')).toBe(featured.imageSrc)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
