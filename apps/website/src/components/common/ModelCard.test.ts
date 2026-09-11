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
  it('exposes image model details and a named provider badge semantically', () => {
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
    expect(
      screen
        .getByRole('img', { name: 'Black Forest Labs' })
        .getAttribute('aria-label')
    ).toBe('Black Forest Labs')
    expect(
      screen
        .getByRole('img', { name: 'Flux 1.1 Pro preview' })
        .getAttribute('src')
    ).toBe('/models/flux-1-1-pro.webp')
  })

  it('renders a static video preview without loading it eagerly', () => {
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

    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(video.hasAttribute('muted')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.getAttribute('preload')).toBe('none')
    expect(video.getAttribute('poster')).toBe(
      '/models/flux-1-1-pro-poster.webp'
    )
    expect(video.getAttribute('src')).toBe('/models/flux-1-1-pro.mp4')
  })
})
