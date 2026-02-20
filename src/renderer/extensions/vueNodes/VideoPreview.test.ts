import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import VideoPreview from '@/renderer/extensions/vueNodes/VideoPreview.vue'

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        downloadVideo: 'Download video',
        removeVideo: 'Remove video',
        viewVideoOfTotal: 'View video {index} of {total}',
        videoPreview:
          'Video preview - Use arrow keys to navigate between videos',
        errorLoadingVideo: 'Error loading video',
        failedToDownloadVideo: 'Failed to download video',
        calculatingDimensions: 'Calculating dimensions',
        videoFailedToLoad: 'Video failed to load',
        loading: 'Loading'
      }
    }
  }
})

describe('VideoPreview', () => {
  const defaultProps: ComponentProps<typeof VideoPreview> = {
    imageUrls: [
      '/api/view?filename=test1.mp4&type=output',
      '/api/view?filename=test2.mp4&type=output'
    ]
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  function mountVideoPreview(
    props: Partial<ComponentProps<typeof VideoPreview>> = {}
  ) {
    return mount(VideoPreview, {
      props: { ...defaultProps, ...props } as ComponentProps<
        typeof VideoPreview
      >,
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
        stubs: {
          Skeleton: true
        }
      }
    })
  }

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical videos', async () => {
      const sameUrl = '/api/view?filename=test.mp4&type=output'
      const wrapper = mountVideoPreview({
        imageUrls: [sameUrl, sameUrl, sameUrl]
      })

      // Simulate initial video load
      await wrapper.find('video').trigger('loadeddata')
      await nextTick()
      expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

      // Click second navigation dot to cycle to identical URL
      const dots = wrapper.findAll('[aria-label^="View video"]')
      await dots[1].trigger('click')
      await nextTick()

      // Should NOT be in loading state since URL didn't change
      expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    })

    it('should show loader when cycling to a different URL', async () => {
      const wrapper = mountVideoPreview({
        imageUrls: [
          '/api/view?filename=a.mp4&type=output',
          '/api/view?filename=b.mp4&type=output'
        ]
      })

      // Simulate initial video load
      await wrapper.find('video').trigger('loadeddata')
      await nextTick()
      expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

      // Click second dot — different URL
      const dots = wrapper.findAll('[aria-label^="View video"]')
      await dots[1].trigger('click')
      await nextTick()

      // Should be in loading state since URL changed
      expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    })
  })
})
