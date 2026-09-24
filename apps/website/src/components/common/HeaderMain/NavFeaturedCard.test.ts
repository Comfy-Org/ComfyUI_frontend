import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

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
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('offers a pause control outside the card link for the video', async () => {
    render(NavFeaturedCard, {
      props: {
        featured: { ...featured, videoSrc: 'https://example.com/clip.webm' }
      }
    })
    await nextTick()
    const video = screen.getByLabelText<HTMLVideoElement>('Featured clip')
    video.dispatchEvent(new Event('play'))
    const pause = await screen.findByRole('button', { name: 'Pause' })
    expect(screen.getByRole('link').contains(pause)).toBe(false)

    await userEvent.click(pause)
    expect(video.paused).toBe(true)
    expect(screen.getByRole('button', { name: 'Play' })).toBe(pause)
  })

  it('has no pause control for an image card', () => {
    render(NavFeaturedCard, { props: { featured } })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
