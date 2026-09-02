import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LivePreview from '@/renderer/extensions/vueNodes/components/LivePreview.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        liveSamplingPreview: 'Live sampling preview',
        imageFailedToLoad: 'Image failed to load',
        errorLoadingImage: 'Error loading image',
        calculatingDimensions: 'Calculating dimensions'
      }
    }
  }
})

describe('LivePreview', () => {
  const defaultProps = {
    imageUrl: '/api/view?filename=test_sample.png&type=temp'
  }

  function renderLivePreview(props = {}) {
    return render(LivePreview, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ],
        stubs: {
          'i-lucide:image-off': true
        }
      }
    })
  }

  it('renders preview when imageUrl provided', () => {
    renderLivePreview()

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', defaultProps.imageUrl)
  })

  it('does not render when no imageUrl provided', () => {
    const { container } = renderLivePreview({ imageUrl: null })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.textContent).toBe('')
  })

  it('displays calculating dimensions text initially', () => {
    renderLivePreview()

    screen.getByText('Calculating dimensions')
  })

  it('has proper accessibility attributes', () => {
    renderLivePreview()

    expect(screen.getByRole('img')).toHaveAttribute(
      'alt',
      'Live sampling preview'
    )
  })

  it('handles image load event', async () => {
    const { container } = renderLivePreview()
    const img = screen.getByRole('img')

    Object.defineProperty(img, 'naturalWidth', {
      writable: false,
      value: 512
    })
    Object.defineProperty(img, 'naturalHeight', {
      writable: false,
      value: 512
    })

    await fireEvent.load(img)
    await nextTick()

    expect(container.textContent).toContain('512 x 512')
  })

  it('handles image error state', async () => {
    renderLivePreview()
    const img = screen.getByRole('img')

    await fireEvent.error(img)
    await nextTick()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
  })

  it('resets state when imageUrl changes', async () => {
    const { container, rerender } = renderLivePreview()
    const img = screen.getByRole('img')

    await fireEvent.error(img)
    await nextTick()
    expect(container.textContent).toContain('Error loading image')

    await rerender({ imageUrl: '/new-image.png' })
    await nextTick()

    expect(container.textContent).toContain('Calculating dimensions')
    expect(container.textContent).not.toContain('Error loading image')
  })

  it('shows error state when image fails to load', async () => {
    const { container } = renderLivePreview()
    const img = screen.getByRole('img')

    await fireEvent.error(img)
    await nextTick()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
    expect(container.textContent).toContain('Error loading image')
  })
})
