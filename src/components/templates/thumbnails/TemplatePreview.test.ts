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
        getLogoUrl: () => '/comfy-logo.svg'
      },
      slots: { overlay: '<span>Featured workflow</span>' }
    })

    expect(screen.getByText('Featured workflow')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfy' })).toBeInTheDocument()
    expect(screen.getByTestId('compare-slider-container')).toBeInTheDocument()
  })
})
