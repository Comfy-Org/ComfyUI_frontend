import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

enableAutoUnmount(afterEach)

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
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  const mountGallery = (props = {}) => {
    return mount(MediaLightbox, {
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
        ...props
      },
      attachTo: document.getElementById('app') || undefined
    })
  }

  it('renders overlay with role="dialog" and aria-modal', async () => {
    const wrapper = mountGallery()
    await nextTick()

    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('shows navigation buttons when multiple items', async () => {
    const wrapper = mountGallery()
    await nextTick()

    expect(wrapper.find('[aria-label="Previous"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Next"]').exists()).toBe(true)
  })

  it('hides navigation buttons for single item', async () => {
    const wrapper = mountGallery({
      allGalleryItems: [mockGalleryItems[0]] as ResultItemImpl[]
    })
    await nextTick()

    expect(wrapper.find('[aria-label="Previous"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Next"]').exists()).toBe(false)
  })

  it('shows gallery when activeIndex changes from -1', async () => {
    const wrapper = mountGallery({ activeIndex: -1 })

    expect(wrapper.find('[data-mask]').exists()).toBe(false)

    await wrapper.setProps({ activeIndex: 0 })
    await nextTick()

    expect(wrapper.find('[data-mask]').exists()).toBe(true)
  })

  it('emits update:activeIndex with -1 when close button clicked', async () => {
    const wrapper = mountGallery()
    await nextTick()

    await wrapper.find('[aria-label="Close"]').trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([-1])
  })

  describe('keyboard navigation', () => {
    it('navigates to next item on ArrowRight', async () => {
      const wrapper = mountGallery({ activeIndex: 0 })
      await nextTick()

      await wrapper
        .find('[role="dialog"]')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([1])
    })

    it('navigates to previous item on ArrowLeft', async () => {
      const wrapper = mountGallery({ activeIndex: 1 })
      await nextTick()

      await wrapper
        .find('[role="dialog"]')
        .trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([0])
    })

    it('wraps to last item on ArrowLeft from first', async () => {
      const wrapper = mountGallery({ activeIndex: 0 })
      await nextTick()

      await wrapper
        .find('[role="dialog"]')
        .trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([2])
    })

    it('closes gallery on Escape', async () => {
      const wrapper = mountGallery({ activeIndex: 0 })
      await nextTick()

      await wrapper
        .find('[role="dialog"]')
        .trigger('keydown', { key: 'Escape' })
      await nextTick()

      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([-1])
    })
  })
})
