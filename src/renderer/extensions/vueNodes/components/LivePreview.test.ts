import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
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

function setNaturalDimensions(img: HTMLElement, width: number, height: number) {
  Object.defineProperty(img, 'naturalWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(img, 'naturalHeight', {
    configurable: true,
    value: height
  })
}

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
    setNaturalDimensions(img, 512, 512)
    await fireEvent.load(img)

    expect(container.textContent).toContain('512 x 512')
  })

  it('keeps last good dimensions when imageUrl changes (no flicker)', async () => {
    const { container, rerender } = renderLivePreview()

    const img = screen.getByRole('img')
    setNaturalDimensions(img, 800, 600)
    await fireEvent.load(img)
    expect(container.textContent).toContain('800 x 600')

    await rerender({
      imageUrl: '/api/view?filename=test_sample_2.png&type=temp'
    })

    // Dimensions should still display, not flicker back to "Calculating".
    expect(container.textContent).toContain('800 x 600')
    expect(container.textContent).not.toContain('Calculating dimensions')
  })

  it('handles image error state', async () => {
    renderLivePreview()
    await fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
  })

  it('resets error state when imageUrl changes', async () => {
    const { container, rerender } = renderLivePreview()

    await fireEvent.error(screen.getByRole('img'))
    expect(container.textContent).toContain('Error loading image')

    await rerender({ imageUrl: '/new-image.png' })

    expect(container.textContent).not.toContain('Error loading image')
  })

  it('shows error state when image fails to load', async () => {
    const { container } = renderLivePreview()
    await fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
    expect(container.textContent).toContain('Error loading image')
  })
})
