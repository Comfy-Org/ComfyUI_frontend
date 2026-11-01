import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useAssetDownload } from '@/composables/useAssetDownload'
import type { AugmentedResultItem } from '@/utils/resultItem'

import MediaLightbox from './MediaLightbox.vue'

const downloadFiles = vi.fn()

vi.mock(import('@/composables/useAssetDownload'), { spy: true })

beforeEach(() => {
  vi.mocked(useAssetDownload).mockReturnValue({ downloadFiles })
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        gallery: 'Gallery',
        previous: 'Previous',
        next: 'Next',
        download: 'Download',
        videoFailedToLoad: 'Video failed to load',
        textFailedToLoad: 'Text failed to load'
      }
    }
  }
})

type MockResultItem = AugmentedResultItem & {
  id?: string
}

describe('MediaLightbox', () => {
  const mockComfyImage = {
    name: 'ComfyImage',
    template:
      '<img class="mock-comfy-image" data-testid="comfy-image" :src="src" :alt="alt" />',
    props: ['src', 'contain', 'alt']
  }

  const mockResultVideo = {
    name: 'ResultVideo',
    template:
      '<div class="mock-result-video" data-testid="result-video"></div>',
    props: ['result']
  }

  const mockResultAudio = {
    name: 'ResultAudio',
    template:
      '<div class="mock-result-audio" data-testid="result-audio"></div>',
    props: ['result']
  }

  const mockGalleryItems: MockResultItem[] = [
    {
      filename: 'image1.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '123',
      mediaType: 'images',
      url: 'image1.jpg',
      id: '1'
    },
    {
      filename: 'image2.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '456',
      mediaType: 'images',
      url: '/api/assets/2/preview',
      id: '2'
    },
    {
      filename: 'image3.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '789',
      mediaType: 'images',
      url: 'image3.jpg',
      id: '3'
    }
  ]

  const renderGallery = (props = {}, stubs = {}) => {
    const onUpdateActiveIndex = vi.fn()
    const user = userEvent.setup()
    const { rerender, container } = render(MediaLightbox, {
      global: {
        plugins: [i18n],
        components: {
          ComfyImage: mockComfyImage,
          ResultVideo: mockResultVideo,
          ResultAudio: mockResultAudio
        },
        stubs: {
          teleport: true,
          ...stubs
        }
      },
      props: {
        allGalleryItems: mockGalleryItems,
        activeIndex: 0,
        'onUpdate:activeIndex': onUpdateActiveIndex,
        ...props
      },
      container: document.body.appendChild(document.createElement('div'))
    })
    return { user, onUpdateActiveIndex, rerender, container }
  }

  it('renders overlay with role="dialog" and aria-modal', async () => {
    renderGallery()
    await nextTick()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('shows navigation buttons when multiple items', async () => {
    renderGallery()
    await nextTick()

    expect(screen.getByLabelText('Previous')).toBeInTheDocument()
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
  })

  it('hides navigation buttons for single item', async () => {
    renderGallery({
      allGalleryItems: [mockGalleryItems[0]]
    })
    await nextTick()

    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
  })

  it('shows the file name of the item being viewed', async () => {
    renderGallery()
    await nextTick()

    expect(screen.getByTestId('lightbox-filename')).toHaveTextContent(
      'image1.jpg'
    )
  })

  it('keeps the file name in sync with navigation', async () => {
    const { rerender } = renderGallery({ activeIndex: 0 })
    await nextTick()

    await rerender({ allGalleryItems: mockGalleryItems, activeIndex: 1 })
    await nextTick()

    expect(screen.getByTestId('lightbox-filename')).toHaveTextContent(
      'image2.jpg'
    )
  })

  it('downloads the item being viewed under its own file name', async () => {
    const { user } = renderGallery({ activeIndex: 1 })
    await nextTick()

    await user.click(screen.getByLabelText('Download'))

    expect(downloadFiles.mock.calls[0][0][0]).toMatchObject({
      url: '/api/assets/2/preview',
      filename: 'image2.jpg'
    })
  })

  it('downloads the item file rather than the preview it renders', async () => {
    const { user } = renderGallery({
      allGalleryItems: [
        {
          ...mockGalleryItems[0],
          url: '/api/assets/1/preview',
          downloadUrl: '/api/assets/1/content'
        }
      ]
    })
    await nextTick()

    await user.click(screen.getByLabelText('Download'))

    expect(downloadFiles.mock.calls[0][0][0]).toMatchObject({
      url: '/api/assets/1/content',
      filename: 'image1.jpg'
    })
  })

  describe('caption reveal and auto-hide', () => {
    const caption = () => screen.getByTestId('lightbox-caption')

    const finishImageLoad = (filename: string) => {
      screen.getByAltText(filename).dispatchEvent(new Event('load'))
    }

    it('reveals the caption again after it auto-hides', async () => {
      vi.useFakeTimers()
      try {
        const { user } = renderGallery()
        await screen.findByTestId('lightbox-content')
        await nextTick()
        finishImageLoad('image1.jpg')
        await nextTick()
        expect(caption()).toHaveClass('opacity-100')

        await vi.advanceTimersByTimeAsync(2000)
        await nextTick()
        expect(caption()).toHaveClass('opacity-0')

        await user.hover(screen.getByTestId('lightbox-content'))

        expect(caption()).toHaveClass('opacity-100')
      } finally {
        vi.useRealTimers()
      }
    })

    it('auto-hides the caption 2 seconds after the last pointer movement', async () => {
      vi.useFakeTimers()
      try {
        const { user } = renderGallery()
        await screen.findByTestId('lightbox-content')
        await nextTick()
        finishImageLoad('image1.jpg')
        await nextTick()
        expect(caption()).toHaveClass('opacity-100')

        await user.hover(screen.getByTestId('lightbox-content'))
        expect(caption()).toHaveClass('opacity-100')

        await vi.advanceTimersByTimeAsync(2000)
        await nextTick()

        expect(caption()).toHaveClass('opacity-0')
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps the caption hidden after navigation until the new image loads', async () => {
      vi.useFakeTimers()
      try {
        const { rerender } = renderGallery({ activeIndex: 0 })
        await screen.findByTestId('lightbox-content')
        await nextTick()
        finishImageLoad('image1.jpg')
        await nextTick()
        await vi.advanceTimersByTimeAsync(2000)
        await nextTick()
        expect(caption()).toHaveClass('opacity-0')

        await rerender({
          allGalleryItems: mockGalleryItems,
          activeIndex: 1
        })
        await nextTick()
        await nextTick()

        expect(caption()).toHaveTextContent('image2.jpg')
        expect(caption()).toHaveClass('opacity-0')

        finishImageLoad('image2.jpg')
        await nextTick()

        expect(caption()).toHaveClass('opacity-100')
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps the caption visible while hovered and hides it on leave', async () => {
      vi.useFakeTimers()
      try {
        const { user } = renderGallery()
        await nextTick()

        await user.hover(caption())
        await vi.advanceTimersByTimeAsync(5000)
        await nextTick()

        expect(caption()).toHaveClass('opacity-100')

        await user.unhover(caption())
        await nextTick()

        expect(caption()).toHaveClass('opacity-0')
      } finally {
        vi.useRealTimers()
      }
    })

    it('reveals the caption for an image that was already complete on mount', async () => {
      const complete = vi
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true)
      const naturalWidth = vi
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(64)
      try {
        renderGallery()
        await screen.findByTestId('lightbox-content')
        await nextTick()

        expect(caption()).toHaveClass('opacity-100')
      } finally {
        complete.mockRestore()
        naturalWidth.mockRestore()
      }
    })

    it('ignores a late load from the item that was replaced', async () => {
      const { rerender } = renderGallery({ activeIndex: 0 })
      await screen.findByTestId('lightbox-content')
      await nextTick()
      const replaced = screen.getByAltText('image1.jpg')

      await rerender({ allGalleryItems: mockGalleryItems, activeIndex: 1 })
      await nextTick()
      await nextTick()

      expect(caption()).toHaveTextContent('image2.jpg')
      expect(caption()).toHaveClass('opacity-0')

      replaced.dispatchEvent(new Event('load'))
      await nextTick()

      expect(caption()).toHaveClass('opacity-0')

      screen.getByAltText('image2.jpg').dispatchEvent(new Event('load'))
      await nextTick()

      expect(caption()).toHaveClass('opacity-100')
    })
  })

  it('keeps focus in the viewer when a consumer re-anchors to the same item', async () => {
    const user = userEvent.setup()
    const { rerender } = render(MediaLightbox, {
      global: { plugins: [i18n] },
      props: { allGalleryItems: mockGalleryItems, activeIndex: 0 }
    })
    await nextTick()

    const download = screen.getByLabelText('Download')
    await user.click(download)
    expect(download).toHaveFocus()

    await rerender({
      allGalleryItems: [
        mockGalleryItems[2],
        mockGalleryItems[0],
        mockGalleryItems[1]
      ],
      activeIndex: 1
    })
    await nextTick()
    await nextTick()

    expect(download).toHaveFocus()
  })

  it('returns focus to the trigger after navigating and closing', async () => {
    const GalleryHost = defineComponent({
      components: { MediaLightbox },
      setup: () => ({ activeIndex: ref(-1), items: mockGalleryItems }),
      template: `
        <button @click="activeIndex = 0">Open viewer</button>
        <MediaLightbox
          v-model:active-index="activeIndex"
          :all-gallery-items="items"
        />
      `
    })
    const user = userEvent.setup()
    render(GalleryHost, {
      global: {
        plugins: [i18n],
        components: {
          ComfyImage: mockComfyImage,
          ResultVideo: mockResultVideo,
          ResultAudio: mockResultAudio
        }
      }
    })

    const trigger = screen.getByRole('button', { name: 'Open viewer' })
    await user.click(trigger)
    await nextTick()

    await user.click(screen.getByLabelText('Next'))
    await nextTick()

    await user.click(screen.getByLabelText('Close'))
    await nextTick()

    expect(trigger).toHaveFocus()
  })

  it('shows gallery when activeIndex changes from -1', async () => {
    const { rerender, container } = renderGallery({ activeIndex: -1 })

    /* oxlint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).not.toBeInTheDocument()
    /* oxlint-enable testing-library/no-container, testing-library/no-node-access */

    await rerender({
      allGalleryItems: mockGalleryItems,
      activeIndex: 0
    })
    await nextTick()

    /* oxlint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).toBeInTheDocument()
    /* oxlint-enable testing-library/no-container, testing-library/no-node-access */
  })

  it('emits update:activeIndex with -1 when close button clicked', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.click(screen.getByLabelText('Close'))
    await nextTick()

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
  })

  it('keeps failed text media actionable until the viewer closes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }))

    const { user } = renderGallery(
      {
        allGalleryItems: [
          {
            ...mockGalleryItems[0],
            filename: 'failed.txt',
            mediaType: 'text',
            url: '/api/view?filename=failed.txt'
          }
        ]
      },
      { ResultText: false }
    )

    expect(await screen.findByText('Text failed to load')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/view?filename=failed.txt')

    await user.click(screen.getByLabelText('Close'))

    expect(screen.queryByText('Text failed to load')).not.toBeInTheDocument()
  })

  describe('keyboard navigation', () => {
    it('navigates to next item on ArrowRight', async () => {
      const { user, onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(1)
    })

    it('navigates to previous item on ArrowLeft', async () => {
      const { user, onUpdateActiveIndex } = renderGallery({ activeIndex: 1 })
      await nextTick()

      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(0)
    })

    it('wraps to last item on ArrowLeft from first', async () => {
      const { user, onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(2)
    })

    it('closes gallery on Escape', async () => {
      const { user, onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await user.keyboard('{Escape}')
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
    })
  })

  /* oxlint-disable testing-library/no-node-access -- element identity is the behavior under test: the browser only keeps a video's buffer if the same node survives navigation. The real Teleport must render (the test-utils teleport stub remounts its subtree and would defeat KeepAlive), so queries go through document.body. */
  describe('video retention across navigation', () => {
    const videoItem = (n: number): MockResultItem => ({
      filename: `v${n}.mp4`,
      subfolder: '',
      type: 'output',
      nodeId: `${n}`,
      mediaType: 'video',
      url: `http://assets.test/v${n}.mp4`,
      id: `v${n}`
    })

    const renderTeleported = (
      items: MockResultItem[],
      extraProps: { autoplayVideo?: boolean } = {}
    ) => {
      const { rerender } = render(MediaLightbox, {
        global: { plugins: [i18n] },
        props: {
          allGalleryItems: items,
          activeIndex: 0,
          ...extraProps
        }
      })
      const show = async (activeIndex: number) => {
        await rerender({
          allGalleryItems: items,
          activeIndex,
          ...extraProps
        })
        await nextTick()
      }
      const video = () => document.body.querySelector('video')
      return { show, video }
    }

    it('keeps the same video element when leaving and returning', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        mockGalleryItems[0]
      ])
      await nextTick()

      const first = video()
      expect(first).not.toBeNull()
      first!.dataset.probe = 'kept'

      await show(1)
      expect(video()).toBeNull()

      await show(0)
      const returned = video()
      expect(returned).toBe(first)
      expect(returned!.dataset.probe).toBe('kept')
    })

    it('mounts a distinct element and source for a different video', async () => {
      const { show, video } = renderTeleported([videoItem(1), videoItem(2)])
      await nextTick()
      const first = video()

      await show(1)
      const second = video()

      expect(second).not.toBe(first)
      expect(second!.querySelector('source')!.getAttribute('src')).toBe(
        'http://assets.test/v2.mp4'
      )
    })

    it('evicts the oldest video past the retention bound', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        videoItem(2),
        videoItem(3),
        videoItem(4)
      ])
      await nextTick()
      const first = video()

      for (const index of [1, 2, 3]) await show(index)

      await show(0)
      expect(video()).not.toBe(first)
    })

    it('PM-1895 starts an opt-in video on open and again on return', async () => {
      const { show, video } = renderTeleported(
        [videoItem(1), mockGalleryItems[0]],
        { autoplayVideo: true }
      )
      await nextTick()

      const first = video()
      expect(first?.autoplay).toBe(true)
      expect(first?.paused).toBe(false)

      first?.pause()
      await show(1)
      await show(0)

      expect(video()?.paused).toBe(false)
    })

    it('leaves playback alone for callers that do not opt in', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        mockGalleryItems[0]
      ])
      await nextTick()

      expect(video()?.autoplay).toBe(false)

      await show(1)
      await show(0)

      expect(video()?.paused).toBe(true)
    })

    it('drops retained videos when the lightbox closes', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        mockGalleryItems[0]
      ])
      await nextTick()
      const first = video()

      await show(-1)
      await show(0)

      const reopened = video()
      expect(reopened).not.toBeNull()
      expect(reopened).not.toBe(first)
    })
  })
  /* oxlint-enable testing-library/no-node-access */
})
