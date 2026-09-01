import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

import MediaLightbox from './MediaLightbox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        gallery: 'Gallery',
        previous: 'Previous',
        next: 'Next'
      }
    }
  }
})

type MockResultItem = Partial<ResultItemImpl> & {
  filename: string
  subfolder: string
  type: string
  nodeId: NodeId
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
      nodeId: '123' as NodeId,
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
      nodeId: '456' as NodeId,
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
      nodeId: '789' as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image3.jpg',
      id: '3'
    }
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
  })

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
})
