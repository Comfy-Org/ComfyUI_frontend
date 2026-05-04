import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

const useImageMock = vi.hoisted(() => ({
  state: null as Ref<HTMLImageElement | undefined> | null,
  isReady: null as Ref<boolean> | null
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  const { ref } = await import('vue')
  useImageMock.state = ref<HTMLImageElement | undefined>(undefined)
  useImageMock.isReady = ref(false)
  return {
    ...(actual as Record<string, unknown>),
    useImage: () => ({
      state: useImageMock.state,
      isReady: useImageMock.isReady
    })
  }
})

const executionStatusMock = vi.hoisted(() => ({
  message: null as Ref<string | null> | null
}))

vi.mock('@/renderer/extensions/linearMode/useExecutionStatus', async () => {
  const { ref } = await import('vue')
  executionStatusMock.message = ref<string | null>(null)
  return {
    useExecutionStatus: () => ({
      executionStatusMessage: executionStatusMock.message
    })
  }
})

import ImagePreview from './ImagePreview.vue'

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderImagePreview(props: Record<string, unknown> = {}) {
  return render(ImagePreview, {
    props: { src: 'https://example.com/image.png', ...props },
    global: {
      plugins: [i18n],
      stubs: {
        ZoomPane: {
          template: '<div data-testid="zoom-pane"><slot /></div>'
        }
      }
    }
  })
}

function setLoadedImage(width: number, height: number) {
  const fakeImage = { naturalWidth: width, naturalHeight: height } as
    | HTMLImageElement
    | undefined
  useImageMock.state!.value = fakeImage
  useImageMock.isReady!.value = true
}

describe('ImagePreview (linearMode)', () => {
  beforeEach(() => {
    if (useImageMock.state) useImageMock.state.value = undefined
    if (useImageMock.isReady) useImageMock.isReady.value = false
    if (executionStatusMock.message) executionStatusMock.message.value = null
  })

  it('renders src inside ZoomPane in desktop mode', () => {
    renderImagePreview()
    expect(screen.getByTestId('zoom-pane')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/image.png'
    )
  })

  it('renders bare img when mobile is true', () => {
    renderImagePreview({ mobile: true })
    expect(screen.queryByTestId('zoom-pane')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/image.png'
    )
  })

  it('shows dimensions once the image is ready', async () => {
    renderImagePreview()
    setLoadedImage(800, 600)
    await nextTick()
    expect(screen.getByText('800 x 600')).toBeInTheDocument()
  })

  it('appends label when provided alongside dimensions', async () => {
    renderImagePreview({ label: 'demo' })
    setLoadedImage(64, 32)
    await nextTick()
    expect(screen.getByText(/64 x 32/)).toBeInTheDocument()
    expect(screen.getByText(/demo/)).toBeInTheDocument()
  })

  it('does not show dimensions when showSize=false', async () => {
    renderImagePreview({ showSize: false })
    setLoadedImage(800, 600)
    await nextTick()
    expect(screen.queryByText('800 x 600')).not.toBeInTheDocument()
  })

  it('does not show dimensions before the image is ready', () => {
    renderImagePreview()
    expect(screen.queryByText(/x/)).not.toBeInTheDocument()
  })

  it('shows execution status message instead of dimensions when present', async () => {
    renderImagePreview()
    setLoadedImage(800, 600)
    executionStatusMock.message!.value = 'Generating…'
    await nextTick()
    expect(screen.getByText('Generating…')).toBeInTheDocument()
    expect(screen.queryByText('800 x 600')).not.toBeInTheDocument()
  })
})
