import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LightboxItem } from '@/types/lightboxItem'

import MediaLightbox from '@/components/common/MediaLightbox.vue'

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
        videoFailedToLoad: 'Video failed to load',
        textFailedToLoad: 'Text failed to load'
      }
    }
  }
})

describe('MediaLightbox', () => {
  const mockGalleryItems: LightboxItem[] = [
    { kind: 'image', url: 'image1.jpg', alt: 'image1.jpg' },
    { kind: 'image', url: 'image2.jpg', alt: 'image2.jpg' },
    { kind: 'image', url: 'image3.jpg', alt: 'image3.jpg' }
  ]

  const createOpener = () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open gallery'
    document.body.append(opener)
    onTestFinished(() => opener.remove())
    opener.focus()
    return opener
  }

  const renderGallery = (props = {}, stubs = {}) => {
    const onUpdateActiveIndex = vi.fn()
    const user = userEvent.setup()
    const { rerender, container } = render(MediaLightbox, {
      global: {
        plugins: [i18n],
        stubs
      },
      props: {
        items: mockGalleryItems,
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

  it('navigates and wraps from the buttons', async () => {
    const { user, onUpdateActiveIndex, rerender } = renderGallery({
      activeIndex: 2
    })
    await nextTick()

    await user.click(screen.getByLabelText('Next'))
    expect(onUpdateActiveIndex).toHaveBeenLastCalledWith(0)

    await rerender({ activeIndex: 0 })
    await user.click(screen.getByLabelText('Previous'))
    expect(onUpdateActiveIndex).toHaveBeenLastCalledWith(2)
  })

  it('hides navigation buttons for single item', async () => {
    renderGallery({
      items: [mockGalleryItems[0]]
    })
    await nextTick()

    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
  })

  it('shows gallery when activeIndex changes from null', async () => {
    const { rerender } = renderGallery({ activeIndex: null })

    expect(
      screen.queryByRole('dialog', { name: 'Gallery' })
    ).not.toBeInTheDocument()

    await rerender({
      items: mockGalleryItems,
      activeIndex: 0
    })
    await nextTick()

    expect(screen.getByRole('dialog', { name: 'Gallery' })).toBeInTheDocument()
  })

  it('closes instead of rendering an invalid selection', async () => {
    const { onUpdateActiveIndex } = renderGallery({ activeIndex: 99 })
    await nextTick()

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(null)
    expect(
      screen.queryByRole('dialog', { name: 'Gallery' })
    ).not.toBeInTheDocument()
  })

  it('emits update:activeIndex with null when close button clicked', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.click(screen.getByLabelText('Close'))
    await nextTick()

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(null)
  })

  it('closes when a backdrop press and release stay on the backdrop', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.click(screen.getByRole('dialog', { name: 'Gallery' }))

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(null)
  })

  it('stays open when a press starts on the media', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('img', { name: 'image1.jpg' })
      },
      {
        keys: '[/MouseLeft]',
        target: screen.getByRole('dialog', { name: 'Gallery' })
      }
    ])

    expect(onUpdateActiveIndex).not.toHaveBeenCalledWith(null)
  })

  it('returns focus to the opener after navigating and closing', async () => {
    const opener = createOpener()

    const { rerender } = renderGallery({ activeIndex: null })
    await rerender({ activeIndex: 0 })
    await nextTick()
    await rerender({ activeIndex: 1 })
    await nextTick()
    await rerender({ activeIndex: null })
    await nextTick()

    expect(opener).toHaveFocus()
  })

  it('returns focus to the opener when the gallery is closed externally', async () => {
    const opener = createOpener()

    const { rerender } = renderGallery({ activeIndex: null })
    await rerender({ activeIndex: 0 })
    await nextTick()
    await rerender({ activeIndex: null })
    await nextTick()

    expect(opener).toHaveFocus()
  })

  it('keeps failed text media actionable until the viewer closes', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 503 }))
    )
    vi.stubGlobal('fetch', fetchMock)

    const { user, rerender } = renderGallery(
      {
        items: [{ kind: 'text', url: '/api/view?filename=failed.txt' }]
      },
      { LightboxText: false }
    )

    expect(await screen.findByText('Text failed to load')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/view?filename=failed.txt')

    await user.click(screen.getByLabelText('Close'))
    await rerender({ activeIndex: null })

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

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(null)
    })
  })

  /* eslint-disable testing-library/no-node-access -- element identity is the behavior under test: the browser only keeps a video's buffer if the same node survives navigation. The real Teleport must render (the test-utils teleport stub remounts its subtree and would defeat KeepAlive), so queries go through document.body. */
  describe('video retention across navigation', () => {
    const videoItem = (n: number): LightboxItem => ({
      kind: 'video',
      url: `http://assets.test/v${n}.mp4`,
      mimeType: 'video/mp4'
    })

    const renderTeleported = (items: LightboxItem[]) => {
      const { rerender } = render(MediaLightbox, {
        global: { plugins: [i18n] },
        props: {
          items,
          activeIndex: 0
        }
      })
      const show = async (activeIndex: number | null) => {
        await rerender({
          items,
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

    it('drops retained videos when the lightbox closes', async () => {
      const { show, video } = renderTeleported([
        videoItem(1),
        mockGalleryItems[0]
      ])
      await nextTick()
      const first = video()

      await show(null)
      await show(0)

      const reopened = video()
      expect(reopened).not.toBeNull()
      expect(reopened).not.toBe(first)
    })
  })
  /* eslint-enable testing-library/no-node-access */
})
