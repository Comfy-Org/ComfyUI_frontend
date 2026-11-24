import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ComfyImage from './ComfyImage.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { imageFailedToLoad: 'Image failed to load' } } }
})

const mockImageMetrics = (complete: boolean, naturalWidth: number) => ({
  complete: vi
    .spyOn(HTMLImageElement.prototype, 'complete', 'get')
    .mockReturnValue(complete),
  naturalWidth: vi
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(naturalWidth)
})

describe('ComfyImage', () => {
  it('emits load on mount when the image is already complete', async () => {
    const metrics = mockImageMetrics(true, 64)
    try {
      const onLoad = vi.fn()
      render(ComfyImage, {
        global: { plugins: [i18n] },
        props: { src: 'cached.png', alt: 'cached', onLoad }
      })
      await nextTick()

      expect(onLoad).toHaveBeenCalledOnce()
    } finally {
      metrics.complete.mockRestore()
      metrics.naturalWidth.mockRestore()
    }
  })

  it('waits for the image when it is still loading at mount', async () => {
    const metrics = mockImageMetrics(false, 0)
    try {
      const onLoad = vi.fn()
      render(ComfyImage, {
        global: { plugins: [i18n] },
        props: { src: 'loading.png', alt: 'loading', onLoad }
      })
      await nextTick()

      expect(onLoad).not.toHaveBeenCalled()
    } finally {
      metrics.complete.mockRestore()
      metrics.naturalWidth.mockRestore()
    }
  })

  it('forwards primary image events and ignores the decorative overlay', async () => {
    const onLoad = vi.fn()
    const onError = vi.fn()
    render(ComfyImage, {
      global: { plugins: [i18n] },
      props: {
        src: 'contained.png',
        alt: 'contained',
        contain: true,
        onLoad,
        onError
      }
    })
    const [overlay, primary] = screen.getAllByAltText('contained')
    expect(overlay).toHaveAttribute('data-test', 'contained.png')

    await fireEvent(overlay, new Event('load'))
    await fireEvent(overlay, new Event('error'))
    expect(onLoad).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()

    await fireEvent(primary, new Event('load'))
    expect(onLoad).toHaveBeenCalledOnce()

    await fireEvent(primary, new Event('error'))
    expect(onError).toHaveBeenCalledOnce()
  })
})
