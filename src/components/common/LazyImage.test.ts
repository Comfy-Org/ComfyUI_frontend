import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, expect, it, vi } from 'vitest'

import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { disposeMediaCache, useMediaCache } from '@/services/mediaCacheService'

import LazyImage from './LazyImage.vue'

vi.mock(import('@/composables/useIntersectionObserver'))

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return () => disposeMediaCache()
})

async function intersect(isIntersecting: boolean) {
  const call = vi.mocked(useIntersectionObserver).mock.calls[0]
  assert.exists(call)
  const target = call[0].value
  assert.exists(target)
  const rect = new DOMRect(0, 0, 100, 100)
  call[1](
    [
      {
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: rect,
        time: 0
      }
    ],
    new IntersectionObserver(() => {})
  )
}

it('defers fetching until visible and releases the image URL when it leaves view', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(new Blob(['image'], { type: 'image/png' }))
  )
  render(LazyImage, { props: { src: '/preview.png', alt: 'Preview' } })
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()

  await intersect(true)
  const image = await screen.findByRole('img', { name: 'Preview' })
  expect(image).toHaveAttribute('src', 'blob:preview')
  await fireEvent.load(image)
  await intersect(false)
  await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument())
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  expect(useMediaCache().cache.has('/preview.png')).toBe(false)
})

it('shows the fallback image with the same accessible name after a failed fetch', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
  render(LazyImage, { props: { src: '/missing.png', alt: 'Missing preview' } })
  await intersect(true)
  expect(
    await screen.findByRole('img', { name: 'Missing preview' })
  ).toHaveAttribute('src', '/assets/images/default-template.png')
})
