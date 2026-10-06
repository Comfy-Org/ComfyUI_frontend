import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

import TemplatePreview from './TemplatePreview.vue'

const template: TemplateInfo = {
  name: 'preview',
  mediaType: 'image',
  mediaSubtype: 'png',
  description: 'Preview fixture'
}

describe('TemplatePreview', () => {
  it('keeps the default image unscaled on hover when zoom is omitted', () => {
    render(TemplatePreview, {
      props: {
        template,
        baseImageSrc: '/preview.png',
        overlayImageSrc: '/overlay.png',
        alt: 'Workflow preview',
        getLogoUrl: vi.fn(),
        isHovered: true
      }
    })

    expect(screen.getByTestId('thumbnail-content')).toHaveStyle({
      transform: 'scale(1)'
    })
  })

  it('renders the selected media branch, logos, and overlay content', () => {
    render(TemplatePreview, {
      props: {
        template: {
          ...template,
          thumbnailVariant: 'compareSlider',
          logos: [{ provider: 'Comfy' }]
        },
        baseImageSrc: '/before.png',
        overlayImageSrc: '/after.png',
        alt: 'Comparison preview',
        getLogoUrl: () => '/comfy-logo.svg',
        isHovered: false
      },
      slots: { overlay: '<span>Featured workflow</span>' }
    })

    expect(screen.getByText('Featured workflow')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfy' })).toBeInTheDocument()
    expect(screen.getByTestId('compare-slider-container')).toBeInTheDocument()
  })

  // LazyImage holds images behind an intersection observer that never fires in
  // jsdom, so stub it to the img it eventually renders.
  const stubs = {
    LazyImage: {
      props: ['src', 'alt'],
      template: '<img :src="src" :alt="alt" />'
    }
  }

  it.for([
    {
      name: 'audio',
      overrides: { mediaType: 'audio' as const },
      assert: () =>
        expect(screen.getByTestId('audio-player')).toBeInTheDocument()
    },
    {
      name: 'compareSlider',
      overrides: { thumbnailVariant: 'compareSlider' as const },
      assert: () =>
        expect(
          screen.getByTestId('compare-slider-container')
        ).toBeInTheDocument()
    },
    {
      name: 'hoverDissolve',
      overrides: { thumbnailVariant: 'hoverDissolve' as const },
      assert: () =>
        expect(screen.getAllByAltText('Workflow preview')).toHaveLength(2)
    },
    {
      name: 'default',
      overrides: {},
      assert: () =>
        expect(screen.getAllByAltText('Workflow preview')).toHaveLength(1)
    }
  ])('dispatches the $name media branch', ({ overrides, assert }) => {
    render(TemplatePreview, {
      props: {
        template: { ...template, ...overrides },
        baseImageSrc: '/preview.png',
        overlayImageSrc: '/overlay.png',
        alt: 'Workflow preview',
        getLogoUrl: vi.fn(),
        isHovered: false
      },
      global: { stubs }
    })

    assert()
  })
})
