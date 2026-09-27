// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CardWorkflow01 from './CardWorkflow01.vue'

describe('CardWorkflow01 links', () => {
  it('keeps an explicitly internal destination in the current tab', () => {
    render(CardWorkflow01, {
      props: {
        item: {
          id: 'internal-model',
          title: 'Internal model',
          href: '/models/internal-model',
          target: '_self',
          media: { type: 'placeholder', alt: '' }
        }
      }
    })

    const link = screen.getByRole('link', { name: 'Internal model' })
    expect(link.getAttribute('target')).toBe('_self')
    expect(link.getAttribute('rel')).toBeNull()
  })

  it('opens an external destination safely by default', () => {
    render(CardWorkflow01, {
      props: {
        item: {
          id: 'external-model',
          title: 'External model',
          href: 'https://blog.comfy.org/model',
          media: { type: 'placeholder', alt: '' }
        }
      }
    })

    const link = screen.getByRole('link', { name: 'External model' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('loads a decorative image preview lazily', () => {
    render(CardWorkflow01, {
      props: {
        item: {
          id: 'image-model',
          title: 'Image model',
          media: {
            type: 'image',
            src: 'https://media.comfy.org/model.webp',
            alt: ''
          }
        }
      }
    })

    const image = screen.getByRole('img', { name: '' })
    expect(image.getAttribute('src')).toBe('https://media.comfy.org/model.webp')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('decoding')).toBe('async')
  })

  it('places a featured status badge over the media', () => {
    render(CardWorkflow01, {
      props: {
        statusBadgePlacement: 'featured-media',
        item: {
          id: 'featured-model',
          title: 'Featured model',
          media: { type: 'placeholder', alt: '' },
          statusBadges: [{ type: 'day-zero', label: 'DAY ZERO' }]
        }
      }
    })

    expect(screen.getAllByText('DAY ZERO')).toHaveLength(1)
  })

  it('shows the workflow source in the showcase card', () => {
    render(CardWorkflow01, {
      props: {
        variant: 'showcase',
        item: {
          id: 'showcase-workflow',
          title: 'Showcase workflow',
          href: 'https://comfy.org/workflows/showcase-workflow',
          sourceLabel: 'ComfyUI',
          media: { type: 'placeholder', alt: '' },
          tags: ['Video']
        }
      }
    })

    expect(screen.getByText('ComfyUI')).toBeTruthy()
    expect(screen.getByText('Video')).toBeTruthy()
    expect(screen.getByTestId('workflow-source-avatar')).toBeTruthy()
  })

  it('omits the ComfyUI avatar for a company source', () => {
    render(CardWorkflow01, {
      props: {
        variant: 'feature',
        item: {
          id: 'company-workflow',
          title: 'Company workflow',
          sourceLabel: 'Alibaba',
          media: { type: 'placeholder', alt: '' }
        }
      }
    })

    expect(screen.getByText('Alibaba')).toBeTruthy()
    expect(screen.queryByTestId('workflow-source-avatar')).toBeNull()
  })

  it('renders provider branding in the featured workflow card', () => {
    render(CardWorkflow01, {
      props: {
        variant: 'feature',
        item: {
          id: 'featured-workflow',
          title: 'Featured workflow',
          href: 'https://comfy.org/workflows/',
          sourceLabel: 'ComfyUI',
          brandIconSrc: '/icons/ai-models/wan.svg',
          media: { type: 'placeholder', alt: '' },
          tags: ['Video']
        }
      }
    })

    expect(
      screen
        .getByRole('link', { name: 'Featured workflow' })
        .getAttribute('href')
    ).toBe('https://comfy.org/workflows/')
    expect(screen.getByText('Featured workflow')).toBeTruthy()
    expect(screen.getByText('ComfyUI')).toBeTruthy()
  })
})
