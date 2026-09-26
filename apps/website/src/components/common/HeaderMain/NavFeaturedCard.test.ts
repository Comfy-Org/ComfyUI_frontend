import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { NavFeatured } from '../../../data/mainNavigation'
import NavFeaturedCard from './NavFeaturedCard.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('../../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const featured: NavFeatured = {
  imageSrc: 'https://example.com/poster.webp',
  imageAlt: 'Featured clip',
  title: 'New release',
  cta: { label: 'Explore', href: '/launch' }
}

function renderVideoCard() {
  render(NavFeaturedCard, {
    props: {
      featured: { ...featured, videoSrc: 'https://example.com/clip.webm' }
    }
  })
  const video = screen.getByLabelText('Featured clip')
  if (!(video instanceof HTMLVideoElement))
    throw new Error('Expected the featured media to be a video')
  return video
}

describe('NavFeaturedCard', () => {
  it('renders the image when no video is set', () => {
    render(NavFeaturedCard, { props: { featured } })
    expect(
      screen.getByRole('img', { name: 'Featured clip' }).getAttribute('src')
    ).toBe(featured.imageSrc)
  })

  it('renders a non-looping video with the image as its poster when a video is set', () => {
    const video = renderVideoCard()
    expect(video.getAttribute('src')).toBe('https://example.com/clip.webm')
    expect(video.getAttribute('poster')).toBe(featured.imageSrc)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it.for([
    { reduced: false, autoplay: true },
    { reduced: true, autoplay: false }
  ])(
    'sets autoplay only without reduced motion (reduced: $reduced)',
    ({ reduced, autoplay }) => {
      motion.reduced = reduced
      onTestFinished(() => {
        motion.reduced = false
      })
      expect(renderVideoCard().hasAttribute('autoplay')).toBe(autoplay)
    }
  )

  it.for([
    { currentTime: 4, paused: false },
    { currentTime: 4.75, paused: true }
  ])(
    'is paused $paused once playback reaches $currentTime seconds',
    async ({ currentTime, paused }) => {
      const video = renderVideoCard()
      await video.play()
      video.currentTime = currentTime
      video.dispatchEvent(new Event('timeupdate'))
      expect(video.paused).toBe(paused)
    }
  )
})
