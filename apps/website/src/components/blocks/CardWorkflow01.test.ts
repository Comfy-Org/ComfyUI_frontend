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
    const { container } = render(CardWorkflow01, {
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

    const statusGroup = container.querySelector(
      '[data-slot="workflow-status-badges"]'
    )
    const badge = statusGroup?.querySelector('[data-slot="badge"]')

    expect(statusGroup?.getAttribute('data-placement')).toBe('featured-media')
    expect(badge?.getAttribute('data-size')).toBe('feature')
    expect(badge?.classList.contains('h-7')).toBe(true)
    expect(screen.getAllByText('DAY ZERO')).toHaveLength(1)
  })
})
