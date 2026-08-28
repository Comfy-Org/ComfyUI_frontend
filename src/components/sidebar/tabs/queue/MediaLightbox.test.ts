import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ResultItemImpl } from '@/stores/queueStore'
import type { SerializedNodeId } from '@/types/nodeId'

import MediaLightbox from './MediaLightbox.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => undefined })
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    isExtensionInstalled: () => false,
    isExtensionEnabled: () => false
  })
}))

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
        videoFailedToLoad: 'Video failed to load'
      }
    }
  }
})

type MockResultItem = Partial<ResultItemImpl> & {
  filename: string
  subfolder: string
  type: string
  nodeId: SerializedNodeId
  mediaType: string
  id?: string
  url?: string
  isImage?: boolean
  isVideo?: boolean
  isAudio?: boolean
}

describe('MediaLightbox', () => {
  const mockComfyImage = {
    name: 'ComfyImage',
    template: '<div class="mock-comfy-image" data-testid="comfy-image"></div>',
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
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image1.jpg',
      id: '1'
    },
    {
      filename: 'image2.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '456',
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image2.jpg',
      id: '2'
    },
    {
      filename: 'image3.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '789',
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image3.jpg',
      id: '3'
    }
  ]

  const renderGallery = (props = {}) => {
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
          teleport: true
        }
      },
      props: {
        allGalleryItems: mockGalleryItems as ResultItemImpl[],
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
      allGalleryItems: [mockGalleryItems[0]] as ResultItemImpl[]
    })
    await nextTick()

    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
  })

  it('shows gallery when activeIndex changes from -1', async () => {
    const { rerender, container } = renderGallery({ activeIndex: -1 })

    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).not.toBeInTheDocument()
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */

    await rerender({
      allGalleryItems: mockGalleryItems as ResultItemImpl[],
      activeIndex: 0
    })
    await nextTick()

    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).toBeInTheDocument()
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  })

  it('emits update:activeIndex with -1 when close button clicked', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.click(screen.getByLabelText('Close'))
    await nextTick()

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
  })

  /* eslint-disable testing-library/prefer-user-event -- keyDown on dialog element for navigation, not text input */
  describe('keyboard navigation', () => {
    it('navigates to next item on ArrowRight', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowRight'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(1)
    })

    it('navigates to previous item on ArrowLeft', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 1 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowLeft'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(0)
    })

    it('wraps to last item on ArrowLeft from first', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowLeft'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(2)
    })

    it('closes gallery on Escape', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'Escape'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
    })
  })
  /* eslint-enable testing-library/prefer-user-event */

  /* eslint-disable testing-library/no-node-access -- element identity is the behavior under test: the browser only keeps a video's buffer if the same node survives navigation. The real Teleport must render (the test-utils teleport stub remounts its subtree and would defeat KeepAlive), so queries go through document.body. */
  describe('video retention across navigation', () => {
    const videoItem = (n: number): MockResultItem => ({
      filename: `v${n}.mp4`,
      subfolder: '',
      type: 'output',
      nodeId: `${n}`,
      mediaType: 'video',
      isImage: false,
      isVideo: true,
      isAudio: false,
      url: `http://assets.test/v${n}.mp4`,
      id: `v${n}`
    })

    const renderTeleported = (items: MockResultItem[]) => {
      const { rerender } = render(MediaLightbox, {
        global: { plugins: [i18n] },
        props: {
          allGalleryItems: items as ResultItemImpl[],
          activeIndex: 0
        }
      })
      const show = async (activeIndex: number) => {
        await rerender({
          allGalleryItems: items as ResultItemImpl[],
          activeIndex
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

    it('pauses a retained video when navigating away from it', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        mockGalleryItems[0]
      ])
      await nextTick()
      const first = video()
      expect(first).not.toBeNull()
      const pause = vi.spyOn(first!, 'pause')

      await show(1)

      expect(pause).toHaveBeenCalled()
    })

    /* Regression pin: a closed lightbox must not keep retained videos alive
       (they resumed - audio included - on the next open). */
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
  /* eslint-enable testing-library/no-node-access */
})
