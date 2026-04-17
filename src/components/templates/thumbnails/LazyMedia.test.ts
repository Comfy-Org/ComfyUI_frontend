import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LazyMedia from '@/components/templates/thumbnails/LazyMedia.vue'

const intersectionCallbacks: Array<
  (entries: IntersectionObserverEntry[]) => void
> = []

vi.mock('@/composables/useIntersectionObserver', () => ({
  useIntersectionObserver: (
    _ref: unknown,
    cb: (entries: IntersectionObserverEntry[]) => void
  ) => {
    intersectionCallbacks.push(cb)
  }
}))

vi.mock('@/components/common/LazyImage.vue', () => ({
  default: {
    name: 'LazyImage',
    template:
      '<img data-testid="lazy-image" :src="src" :alt="alt" :class="imageClass" />',
    props: ['src', 'alt', 'imageClass', 'imageStyle', 'rootMargin']
  }
}))

vi.mock('primevue/skeleton', () => ({
  default: {
    name: 'Skeleton',
    template: '<div data-testid="skeleton" />'
  }
}))

function triggerIntersection(isIntersecting: boolean) {
  intersectionCallbacks.forEach((cb) =>
    cb([{ isIntersecting } as IntersectionObserverEntry])
  )
}

describe('LazyMedia', () => {
  beforeEach(() => {
    intersectionCallbacks.length = 0
  })

  it('renders LazyImage for non-video src', () => {
    render(LazyMedia, { props: { src: '/thumb.webp', alt: 'cover' } })
    expect(screen.getByTestId('lazy-image')).toHaveAttribute(
      'src',
      '/thumb.webp'
    )
  })

  it('renders a <video> with Cloudflare poster for hub-asset .mp4 src', async () => {
    render(LazyMedia, {
      props: {
        src: 'https://comfy-hub-assets.comfy.org/uploads/clip.mp4',
        alt: 'video cover'
      }
    })

    triggerIntersection(true)
    await nextTick()

    const video = screen.getByTestId('lazy-video')
    expect(video).toHaveAttribute(
      'src',
      'https://comfy-hub-assets.comfy.org/uploads/clip.mp4'
    )
    expect(video).toHaveAttribute(
      'poster',
      'https://comfy-hub-assets.comfy.org/cdn-cgi/media/mode=frame,time=1s/uploads/clip.mp4'
    )
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('playsinline')
  })

  it('falls back to the Cloudflare frame image when the video errors', async () => {
    render(LazyMedia, {
      props: {
        src: 'https://comfy-hub-assets.comfy.org/uploads/clip.mp4',
        alt: 'video cover'
      }
    })

    triggerIntersection(true)
    await nextTick()

    const video = screen.getByTestId('lazy-video')
    await fireEvent(video, new Event('error'))
    await nextTick()

    expect(screen.queryByTestId('lazy-video')).toBeNull()
    expect(screen.getByTestId('lazy-image')).toHaveAttribute(
      'src',
      'https://comfy-hub-assets.comfy.org/cdn-cgi/media/mode=frame,time=1s/uploads/clip.mp4'
    )
  })

  it('does not mount the video element before intersection', () => {
    render(LazyMedia, {
      props: {
        src: 'https://comfy-hub-assets.comfy.org/uploads/clip.mp4',
        alt: 'video cover'
      }
    })

    expect(screen.queryByTestId('lazy-video')).toBeNull()
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })
})
