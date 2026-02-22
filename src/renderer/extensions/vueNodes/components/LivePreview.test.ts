import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LivePreview from '@/renderer/extensions/vueNodes/components/LivePreview.vue'

const mockState = ref<HTMLImageElement | undefined>(undefined)
const mockError = ref(false)
const mockIsReady = ref(false)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useImage: () => ({
      state: mockState,
      error: mockError,
      isReady: mockIsReady,
      isLoading: ref(false)
    })
  }
})

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
    // Reset mock state before each mount
    mockState.value = undefined
    mockError.value = false
    mockIsReady.value = false

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

  it('displays dimensions when image is ready', async () => {
    const wrapper = mountLivePreview()

    // Simulate useImage reporting the image as ready with dimensions
    const fakeImg = { naturalWidth: 512, naturalHeight: 512 }
    mockState.value = fakeImg as HTMLImageElement
    mockIsReady.value = true
    await nextTick()

    expect(wrapper.text()).toContain('512 x 512')
  })

  it('shows error state when image fails to load', async () => {
    const wrapper = mountLivePreview()

    // Simulate useImage reporting an error
    mockError.value = true
    await nextTick()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Image failed to load')
    expect(wrapper.text()).toContain('Error loading image')
  })

  it('resets state when imageUrl changes', async () => {
    const wrapper = mountLivePreview()

    // Simulate error state
    mockError.value = true
    await nextTick()
    expect(wrapper.text()).toContain('Error loading image')

    // Change imageUrl and reset mock state (simulating useImage auto-reset)
    mockError.value = false
    mockIsReady.value = false
    mockState.value = undefined
    await wrapper.setProps({ imageUrl: '/new-image.png' })
    await nextTick()

    expect(wrapper.text()).toContain('Calculating dimensions')
    expect(wrapper.text()).not.toContain('Error loading image')
  })
})
