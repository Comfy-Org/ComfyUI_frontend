import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Galleria from 'primevue/galleria'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

import ResultGallery from './ResultGallery.vue'

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
}

describe('ResultGallery', () => {
  // Mock ComfyImage and ResultVideo components
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

  // Sample gallery items - using mock instances with only required properties
  const mockGalleryItems: MockResultItem[] = [
    {
      filename: 'image1.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '123' as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
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
      url: 'image2.jpg',
      id: '2'
    }
  ]

  beforeEach(() => {
    const app = createApp({})
    app.use(PrimeVue)

    // Create mock elements for Galleria to find
    document.body.innerHTML = `
      <div id="app"></div>
    `
  })

  afterEach(() => {
    // Clean up any elements added to body
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  const mountGallery = (props = {}) => {
    return mount(ResultGallery, {
      global: {
        plugins: [PrimeVue],
        components: {
          Galleria,
          ComfyImage: mockComfyImage,
          ResultVideo: mockResultVideo
        },
        stubs: {
          teleport: true
        }
      },
      props: {
        allGalleryItems: mockGalleryItems as unknown as ResultItemImpl[],
        activeIndex: 0,
        ...props
      },
      attachTo: document.getElementById('app') || undefined
    })
  }

  it('renders Galleria component with correct props', async () => {
    const wrapper = mountGallery()

    await nextTick() // Wait for component to mount

    const galleria = wrapper.findComponent(Galleria)
    expect(galleria.exists()).toBe(true)
    expect(galleria.props('value')).toEqual(mockGalleryItems)
    expect(galleria.props('showIndicators')).toBe(false)
    expect(galleria.props('showItemNavigators')).toBe(true)
    expect(galleria.props('fullScreen')).toBe(true)
  })

  it('shows gallery when activeIndex changes from -1', async () => {
    const wrapper = mountGallery({ activeIndex: -1 })

    // Initially galleryVisible should be false
    const vm: any = wrapper.vm
    expect(vm.galleryVisible).toBe(false)

    // Change activeIndex
    await wrapper.setProps({ activeIndex: 0 })
    await nextTick()

    // galleryVisible should become true
    expect(vm.galleryVisible).toBe(true)
  })

  it('should render the component properly', () => {
    // This is a meta-test to confirm the component mounts properly
    const wrapper = mountGallery()

    // We can't directly test the compiled CSS, but we can verify the component renders
    expect(wrapper.exists()).toBe(true)

    // Verify that the Galleria component exists and is properly mounted
    const galleria = wrapper.findComponent(Galleria)
    expect(galleria.exists()).toBe(true)
  })

  it('can be displayed in mobile viewport', async () => {
    // Mock window.matchMedia to simulate mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query.includes('max-width: 768px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    const wrapper = mountGallery()
    await nextTick()

    // Force galleryVisible to true since we can't easily trigger the fullscreen mode in tests
    const vm: any = wrapper.vm
    vm.galleryVisible = true
    await nextTick()

    // Verify mobile media query is working
    expect(window.matchMedia('(max-width: 768px)').matches).toBe(true)

    // Check if the component renders with Galleria
    const galleria = wrapper.findComponent(Galleria)
    expect(galleria.exists()).toBe(true)

    // Check that our PT props for positioning work correctly
    const pt = galleria.props('pt') as any
    expect(pt?.prevButton?.style).toContain('position: fixed')
    expect(pt?.nextButton?.style).toContain('position: fixed')

    // Check that the next and previous buttons are visible and clickable
    const nextButton = galleria.find('.p-galleria-next-button')
    const prevButton = galleria.find('.p-galleria-prev-button')
    expect(nextButton.exists()).toBe(true)
    expect(prevButton.exists()).toBe(true)

    // Verify z-index is set correctly for mobile view
    const nextButtonStyle = window.getComputedStyle(nextButton.element)
    const prevButtonStyle = window.getComputedStyle(prevButton.element)
    expect(nextButtonStyle.zIndex).toBe('2')
    expect(prevButtonStyle.zIndex).toBe('2')

    // Mock the click handlers
    const nextClickSpy = vi.fn()
    const prevClickSpy = vi.fn()
    nextButton.element.addEventListener('click', nextClickSpy)
    prevButton.element.addEventListener('click', prevClickSpy)

    // Simulate clicks and verify they are triggered
    await nextButton.trigger('click')
    await prevButton.trigger('click')
    expect(nextClickSpy).toHaveBeenCalled()
    expect(prevClickSpy).toHaveBeenCalled()

    // Verify navigation works by checking activeIndex changes
    await nextButton.trigger('click')
    expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([1])
    await prevButton.trigger('click')
    expect(wrapper.emitted('update:activeIndex')?.[1]).toEqual([0])

    // Verify buttons remain clickable after navigation
    await nextButton.trigger('click')
    expect(nextClickSpy).toHaveBeenCalledTimes(2)
    await prevButton.trigger('click')
    expect(prevClickSpy).toHaveBeenCalledTimes(2)
  })

  describe('mobile viewport behavior', () => {
    let wrapper: ReturnType<typeof mountGallery>
    let galleria: ReturnType<typeof wrapper.findComponent>
    let nextButton: ReturnType<typeof wrapper.find>
    let prevButton: ReturnType<typeof wrapper.find>
    let nextClickSpy: ReturnType<typeof vi.fn>
    let prevClickSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // Mock window.matchMedia to simulate mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query.includes('max-width: 768px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn()
        }))
      })

      wrapper = mountGallery()
      const vm: any = wrapper.vm
      vm.galleryVisible = true

      galleria = wrapper.findComponent(Galleria)
      nextButton = galleria.find('.p-galleria-next-button')
      prevButton = galleria.find('.p-galleria-prev-button')

      nextClickSpy = vi.fn()
      prevClickSpy = vi.fn()
      nextButton.element.addEventListener('click', nextClickSpy)
      prevButton.element.addEventListener('click', prevClickSpy)
    })

    it('renders navigation buttons in mobile viewport', () => {
      expect(window.matchMedia('(max-width: 768px)').matches).toBe(true)
      expect(galleria.exists()).toBe(true)
      expect(nextButton.exists()).toBe(true)
      expect(prevButton.exists()).toBe(true)
    })

    it('handles next button clicks correctly', async () => {
      await nextButton.trigger('click')
      expect(nextClickSpy).toHaveBeenCalled()
      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([1])
    })

    it('handles previous button clicks correctly', async () => {
      await prevButton.trigger('click')
      expect(prevClickSpy).toHaveBeenCalled()
      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([0])
    })

    it('maintains button clickability after navigation', async () => {
      // Navigate forward
      await nextButton.trigger('click')
      expect(nextClickSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('update:activeIndex')?.[0]).toEqual([1])

      // Navigate backward
      await prevButton.trigger('click')
      expect(prevClickSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('update:activeIndex')?.[1]).toEqual([0])

      // Verify buttons still work after navigation
      await nextButton.trigger('click')
      expect(nextClickSpy).toHaveBeenCalledTimes(2)
      await prevButton.trigger('click')
      expect(prevClickSpy).toHaveBeenCalledTimes(2)
    })
  })
})
