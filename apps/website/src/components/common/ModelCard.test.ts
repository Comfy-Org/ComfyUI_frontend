// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelCard from './ModelCard.vue'

const imageCardProps = {
  modelName: 'Flux 1.1 Pro',
  capability: 'Image generation',
  href: '/models/flux-1-1-pro',
  providerName: 'Black Forest Labs',
  providerLogoSrc: '/providers/black-forest-labs.svg',
  media: { type: 'image' as const, src: '/models/flux-1-1-pro.webp' }
}

describe('ModelCard', () => {
  it('exposes image model details semantically', () => {
    render(ModelCard, { props: imageCardProps })

    expect(
      screen
        .getByRole('link', {
          name: 'Black Forest Labs Flux 1.1 Pro Image generation'
        })
        .getAttribute('href')
    ).toBe('/models/flux-1-1-pro')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Flux 1.1 Pro' })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Image generation' })
    ).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Black Forest Labs' })).toBeTruthy()
  })

  it('renders video media with its playback attributes and source', () => {
    render(ModelCard, {
      props: {
        ...imageCardProps,
        media: {
          type: 'video',
          src: '/models/flux-1-1-pro.mp4',
          poster: '/models/flux-1-1-pro-poster.webp'
        }
      }
    })

    const video = screen.getByLabelText('Flux 1.1 Pro preview')

    expect(video.hasAttribute('autoplay')).toBe(true)
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.hasAttribute('muted')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.getAttribute('poster')).toBe(
      '/models/flux-1-1-pro-poster.webp'
    )
    expect(video.getAttribute('src')).toBe('/models/flux-1-1-pro.mp4')
  })
})
