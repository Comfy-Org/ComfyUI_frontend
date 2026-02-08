import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import CompletionSummaryBanner from './CompletionSummaryBanner.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          jobsCompleted: '{count} job completed | {count} jobs completed',
          jobsFailed: '{count} job failed | {count} jobs failed'
        }
      }
    }
  }
})

const mountComponent = (props: Record<string, unknown>) =>
  mount(CompletionSummaryBanner, {
    props: {
      mode: 'allSuccess',
      completedCount: 0,
      failedCount: 0,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })

describe('CompletionSummaryBanner', () => {
  it('renders success mode text, thumbnails, and aria label', () => {
    const wrapper = mountComponent({
      mode: 'allSuccess',
      completedCount: 3,
      failedCount: 0,
      thumbnailUrls: [
        'https://example.com/thumb-a.png',
        'https://example.com/thumb-b.png'
      ],
      ariaLabel: 'Open queue summary'
    })

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Open queue summary')
    expect(wrapper.text()).toContain('3 jobs completed')

    const thumbnailImages = wrapper.findAll('img')
    expect(thumbnailImages).toHaveLength(2)
    expect(thumbnailImages[0].attributes('src')).toBe(
      'https://example.com/thumb-a.png'
    )
    expect(thumbnailImages[1].attributes('src')).toBe(
      'https://example.com/thumb-b.png'
    )

    const thumbnailContainers = wrapper.findAll('.inline-block.h-6.w-6')
    expect(thumbnailContainers[1].attributes('style')).toContain(
      'margin-left: -12px'
    )

    expect(wrapper.html()).not.toContain('icon-[lucide--circle-alert]')
  })

  it('renders mixed mode with success and failure counts', () => {
    const wrapper = mountComponent({
      mode: 'mixed',
      completedCount: 2,
      failedCount: 1
    })

    const summaryText = wrapper.text().replaceAll(/\s+/g, ' ').trim()
    expect(summaryText).toContain('2 jobs completed, 1 job failed')
  })

  it('renders failure mode icon without thumbnails', () => {
    const wrapper = mountComponent({
      mode: 'allFailed',
      completedCount: 0,
      failedCount: 4
    })

    expect(wrapper.text()).toContain('4 jobs failed')
    expect(wrapper.html()).toContain('icon-[lucide--circle-alert]')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
})
