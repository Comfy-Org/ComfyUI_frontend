import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

const useImageMock = vi.hoisted(() => ({
  state: null as Ref<HTMLImageElement | undefined> | null,
  isReady: null as Ref<boolean> | null,
  error: null as Ref<unknown> | null
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  const { ref } = await import('vue')
  useImageMock.state = ref<HTMLImageElement | undefined>(undefined)
  useImageMock.isReady = ref(false)
  useImageMock.error = ref<unknown>(null)
  return {
    ...(actual as Record<string, unknown>),
    useImage: () => ({
      state: useImageMock.state,
      isReady: useImageMock.isReady,
      error: useImageMock.error
    })
  }
})

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

function makeFakeLoadedImage(width: number, height: number): HTMLImageElement {
  const img = new Image()
  Object.defineProperty(img, 'naturalWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(img, 'naturalHeight', {
    configurable: true,
    value: height
  })
  return img
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

  beforeEach(() => {
    useImageMock.state!.value = undefined
    useImageMock.isReady!.value = false
    useImageMock.error!.value = null
  })

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

    useImageMock.state!.value = makeFakeLoadedImage(512, 512)
    useImageMock.isReady!.value = true
    await nextTick()

    expect(container.textContent).toContain('512 x 512')
  })

  it('keeps last good dimensions when imageUrl changes (no flicker)', async () => {
    const { container, rerender } = renderLivePreview()

    useImageMock.state!.value = makeFakeLoadedImage(800, 600)
    useImageMock.isReady!.value = true
    await nextTick()
    expect(container.textContent).toContain('800 x 600')

    // Simulate the source changing during live preview streaming. useImage
    // would normally reset isReady to false until the next image is ready.
    useImageMock.isReady!.value = false
    await rerender({
      imageUrl: '/api/view?filename=test_sample_2.png&type=temp'
    })
    await nextTick()

    // Dimensions should still display, not flicker back to "Calculating".
    expect(container.textContent).toContain('800 x 600')
    expect(container.textContent).not.toContain('Calculating dimensions')
  })

  it('handles image error state', async () => {
    renderLivePreview()
    useImageMock.error!.value = new Event('error')
    await nextTick()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
  })

  it('resets error state when imageUrl changes', async () => {
    const { container, rerender } = renderLivePreview()

    useImageMock.error!.value = new Event('error')
    await nextTick()
    expect(container.textContent).toContain('Error loading image')

    // useImage resets error automatically when src changes.
    useImageMock.error!.value = null
    await rerender({ imageUrl: '/new-image.png' })
    await nextTick()

    expect(container.textContent).not.toContain('Error loading image')
  })

  it('shows error state when image fails to load', async () => {
    const { container } = renderLivePreview()
    useImageMock.error!.value = new Event('error')
    await nextTick()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    screen.getByText('Image failed to load')
    expect(container.textContent).toContain('Error loading image')
  })
})
