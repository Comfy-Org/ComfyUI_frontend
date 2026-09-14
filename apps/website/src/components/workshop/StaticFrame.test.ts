// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import StaticFrame from './StaticFrame.vue'

function stubImages() {
  const images: HTMLImageElement[] = []
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        const image = document.createElement('img')
        Object.defineProperties(image, {
          naturalWidth: { value: 32 },
          naturalHeight: { value: 24 }
        })
        images.push(image)
        return image
      }
    }
  )
  return images
}

describe('StaticFrame', () => {
  it('draws the new source and drops obsolete image callbacks on replacement and unmount', async () => {
    const images = stubImages()
    const { rerender, unmount } = render(StaticFrame, {
      props: { src: '/a.webp', alt: 'Sample' }
    })
    await nextTick()
    const canvas = screen.getByRole('img', { name: 'Sample' })
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error('Expected canvas')
    const context = {
      drawImage: vi.fn()
    } satisfies Partial<CanvasRenderingContext2D>
    Object.defineProperty(canvas, 'getContext', { value: () => context })
    images[0].dispatchEvent(new Event('load'))
    expect(context.drawImage).toHaveBeenCalledWith(images[0], 0, 0)
    expect([canvas.width, canvas.height]).toEqual([32, 24])
    await rerender({ src: '/b.webp', alt: 'Sample' })
    expect(images[1].src).toContain('/b.webp')
    context.drawImage.mockClear()
    images[0].dispatchEvent(new Event('load'))
    expect(context.drawImage).not.toHaveBeenCalled()
    images[1].dispatchEvent(new Event('load'))
    expect(context.drawImage).toHaveBeenCalledWith(images[1], 0, 0)
    images[0].dispatchEvent(new Event('error'))
    expect([canvas.width, canvas.height]).toEqual([32, 24])
    unmount()
    context.drawImage.mockClear()
    images[1].dispatchEvent(new Event('load'))
    expect(context.drawImage).not.toHaveBeenCalled()
    images[1].dispatchEvent(new Event('error'))
    expect([canvas.width, canvas.height]).toEqual([32, 24])
  })

  it('clears the previous frame when its replacement starts and stays clear on error', async () => {
    const images = stubImages()
    const { rerender } = render(StaticFrame, {
      props: { src: '/a.webp', alt: 'Sample' }
    })
    await nextTick()
    const canvas = screen.getByRole('img', { name: 'Sample' })
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error('Expected canvas')
    Object.defineProperty(canvas, 'getContext', {
      value: () => ({ drawImage: vi.fn() })
    })

    images[0].dispatchEvent(new Event('load'))
    expect([canvas.width, canvas.height]).toEqual([32, 24])

    await rerender({ src: '/missing.webp', alt: 'Sample' })
    expect([canvas.width, canvas.height]).toEqual([0, 0])
    images[1].dispatchEvent(new Event('error'))
    expect([canvas.width, canvas.height]).toEqual([0, 0])
  })

  it('exposes the frame as an image only when it has a name', () => {
    render(StaticFrame, { props: { src: '/a.webp', alt: 'Seedance' } })
    expect(screen.getByRole('img', { name: 'Seedance' })).toBeTruthy()
  })

  it('stays decorative without a name', () => {
    render(StaticFrame, { props: { src: '/a.webp' } })
    expect(screen.getByTestId('static-frame').getAttribute('aria-hidden')).toBe(
      'true'
    )
  })
})
