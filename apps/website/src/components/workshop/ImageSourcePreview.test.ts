// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/vue'
import { resolveObjectURL } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import ImageSourcePreview from './ImageSourcePreview.vue'

describe('image source previews', () => {
  it('does not emit a server-owned Blob URL into the page HTML', async () => {
    const create = vi.spyOn(URL, 'createObjectURL')
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(ImageSourcePreview, {
            file: new File(['image'], 'source.png', { type: 'image/png' }),
            name: 'Source image'
          })
      })
    )
    expect(create).not.toHaveBeenCalled()
    expect(html).not.toContain('blob:')
  })

  it('releases local image data on replacement and unmount', async () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    const { rerender, unmount } = render(ImageSourcePreview, {
      props: { file: first, name: first.name }
    })
    const firstUrl = (
      await screen.findByRole('img', { name: first.name })
    ).getAttribute('src')
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
