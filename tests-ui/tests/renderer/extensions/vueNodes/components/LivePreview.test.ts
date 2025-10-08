import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LivePreview from '@/renderer/extensions/vueNodes/components/LivePreview.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        liveSamplingPreview: 'Live sampling preview',
        imageFailedToLoad: 'Image failed to load',
        errorLoadingImage: 'Error loading image',
        calculatingDimensions: 'Calculating dimensions'
      }
    }
  }
})

describe('LivePreview', () => {
  const defaultProps = {
    imageUrl: '/api/view?filename=test_sample.png&type=temp'
  }

  const mountLivePreview = (props = {}) => {
    return mount(LivePreview, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ],
        stubs: {
          'i-lucide:image-off': true
        }
      }
    })
  }

  it('renders preview when imageUrl provided', () => {
    const wrapper = mountLivePreview()

    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe(defaultProps.imageUrl)
  })

  it('does not render when no imageUrl provided', () => {
    const wrapper = mountLivePreview({ imageUrl: null })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('displays calculating dimensions text initially', () => {
    const wrapper = mountLivePreview()

    expect(wrapper.text()).toContain('Calculating dimensions')
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mountLivePreview()

    const img = wrapper.find('img')
    expect(img.attributes('alt')).toBe('Live sampling preview')
  })

  it('applies responsive container classes', () => {
    const wrapper = mountLivePreview()

    const container = wrapper.find('div')
    expect(container.classes()).toContain('w-full')
    expect(container.classes()).toContain('h-full')
    expect(container.classes()).toContain('flex-col')
  })

  it('applies responsive image container classes', () => {
    const wrapper = mountLivePreview()

    const imageContainer = wrapper.find('.bg-node-component-surface')
    expect(imageContainer.exists()).toBe(true)
    expect(imageContainer.classes()).toContain('h-88')
    expect(imageContainer.classes()).toContain('grow')
    expect(imageContainer.classes()).toContain('w-full')
  })

  it('applies object-contain to image', () => {
    const wrapper = mountLivePreview()

    const img = wrapper.find('img')
    expect(img.classes()).toContain('object-contain')
    expect(img.classes()).toContain('object-center')
    expect(img.classes()).toContain('pointer-events-none')
  })

  it('handles image load event', async () => {
    const wrapper = mountLivePreview()

    // Directly access the component and set the actual dimensions
    const component = wrapper.vm as any
    component.actualDimensions = '512 x 512'
    component.imageError = false
    await nextTick()

    expect(wrapper.text()).toContain('512 x 512')
  })

  it('handles image error state', async () => {
    const wrapper = mountLivePreview()

    // Directly access the component and set error state
    const component = wrapper.vm as any
    component.imageError = true
    component.actualDimensions = null
    await nextTick()

    // Check that the image is hidden and error content is shown
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Image failed to load')
  })

  it('resets state when imageUrl changes', async () => {
    const wrapper = mountLivePreview()

    // Set initial state
    const component = wrapper.vm as any
    component.actualDimensions = '512 x 512'
    component.imageError = true
    await nextTick()

    // Change imageUrl prop
    await wrapper.setProps({ imageUrl: '/new-image.png' })
    await nextTick()

    // State should be reset
    expect(component.actualDimensions).toBe(null)
    expect(component.imageError).toBe(false)
  })

  it('shows error state when image fails to load', async () => {
    const wrapper = mountLivePreview()

    // Directly set the error state
    const component = wrapper.vm as any
    component.imageError = true
    await nextTick()

    // Should show error state instead of image
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.text-gray-400').exists()).toBe(true)
    expect(wrapper.text()).toContain('Image failed to load')
  })

  it('displays error loading image text in dimensions area when error occurs', async () => {
    const wrapper = mountLivePreview()

    // Directly set the error state
    const component = wrapper.vm as any
    component.imageError = true
    await nextTick()

    const dimensionsArea = wrapper.find('.text-center.mt-1')
    expect(dimensionsArea.text()).toBe('Error loading image')
  })
})
