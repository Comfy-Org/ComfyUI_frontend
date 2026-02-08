import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueNotificationBanner from '@/components/queue/QueueNotificationBanner.vue'
import type { QueueNotificationBanner as QueueNotificationBannerItem } from '@/composables/queue/useQueueNotificationBanners'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          preview: 'Preview',
          jobsAddedToQueue:
            '{count} job added to queue | {count} jobs added to queue',
          jobsCompleted: '{count} job completed | {count} jobs completed',
          jobsFailed: '{count} job failed | {count} jobs failed'
        }
      }
    }
  }
})

const mountComponent = (notification: QueueNotificationBannerItem) =>
  mount(QueueNotificationBanner, {
    props: { notification },
    global: {
      plugins: [i18n]
    }
  })

describe('QueueNotificationBanner', () => {
  it('renders queued message with pluralization', () => {
    const wrapper = mountComponent({
      type: 'queued',
      count: 2
    })

    expect(wrapper.text()).toContain('2 jobs added to queue')
    expect(wrapper.html()).toContain('icon-[lucide--check]')
  })

  it('renders failed message and alert icon', () => {
    const wrapper = mountComponent({
      type: 'failed',
      count: 1
    })

    expect(wrapper.text()).toContain('1 job failed')
    expect(wrapper.html()).toContain('icon-[lucide--circle-alert]')
  })

  it('renders completed message with thumbnail preview when provided', () => {
    const wrapper = mountComponent({
      type: 'completed',
      count: 3,
      thumbnailUrl: 'https://example.com/preview.png'
    })

    expect(wrapper.text()).toContain('3 jobs completed')
    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('https://example.com/preview.png')
    expect(image.attributes('alt')).toBe('Preview')
  })
})
