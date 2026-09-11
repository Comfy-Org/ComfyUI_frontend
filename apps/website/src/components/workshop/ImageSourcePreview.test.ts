// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/vue'
import { resolveObjectURL } from 'node:buffer'
import { describe, expect, it } from 'vitest'

import ImageSourcePreview from './ImageSourcePreview.vue'

describe('image source previews', () => {
  it('releases local image data on replacement and unmount', async () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    const { rerender, unmount } = render(ImageSourcePreview, {
      props: { file: first, name: first.name }
    })
    const firstUrl = screen
      .getByRole('img', { name: first.name })
      .getAttribute('src')
    if (!firstUrl) throw new Error('Missing local image preview')
    expect(await resolveObjectURL(firstUrl)?.text()).toBe('first')
    await rerender({ file: second, name: second.name })
    const secondUrl = screen
      .getByRole('img', { name: second.name })
      .getAttribute('src')
    if (!secondUrl) throw new Error('Missing replacement image preview')
    expect(resolveObjectURL(firstUrl)).toBeUndefined()
    expect(await resolveObjectURL(secondUrl)?.text()).toBe('second')
    unmount()
    expect(resolveObjectURL(secondUrl)).toBeUndefined()
  })

  it('shows a short inline message for an unavailable preview and retries a new source', async () => {
    const { rerender } = render(ImageSourcePreview, {
      props: { name: 'Image', src: 'https://example.com/missing.png' }
    })
    await fireEvent.error(screen.getByRole('img', { name: 'Image' }))
    expect(screen.getByRole('status').textContent).toContain(
      'Image preview unavailable'
    )
    expect(screen.queryByRole('img')).toBeNull()
    await rerender({
      name: 'Image',
      src: 'https://example.com/replacement.png'
    })
    expect(screen.getByRole('img', { name: 'Image' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
