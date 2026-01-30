import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueOverlayEmpty from './QueueOverlayEmpty.vue'
import type { CompletionSummary } from '@/composables/queue/useCompletionSummary'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          expandCollapsedQueue: 'Expand job queue',
          noActiveJobs: 'No active jobs'
        }
      }
    }
  }
})

const CompletionSummaryBannerStub = {
  name: 'CompletionSummaryBanner',
  props: [
    'mode',
    'completedCount',
    'failedCount',
    'thumbnailUrls',
    'ariaLabel'
  ],
  emits: ['click'],
  template: '<button class="summary-banner" @click="$emit(\'click\')"></button>'
}

const mountComponent = (summary: CompletionSummary) =>
  mount(QueueOverlayEmpty, {
    props: { summary },
    global: {
      plugins: [i18n],
      components: { CompletionSummaryBanner: CompletionSummaryBannerStub }
    }
  })

describe('QueueOverlayEmpty', () => {
  it('renders completion summary banner and proxies click', async () => {
    const summary: CompletionSummary = {
      mode: 'mixed',
      completedCount: 2,
      failedCount: 1,
      thumbnailUrls: ['thumb-a']
    }

    const wrapper = mountComponent(summary)
    const summaryBanner = wrapper.findComponent(CompletionSummaryBannerStub)

    expect(summaryBanner.exists()).toBe(true)
    expect(summaryBanner.props()).toMatchObject({
      mode: 'mixed',
      completedCount: 2,
      failedCount: 1,
      thumbnailUrls: ['thumb-a'],
      ariaLabel: 'Expand job queue'
    })

    await summaryBanner.trigger('click')
    expect(wrapper.emitted('summaryClick')).toHaveLength(1)
  })
})
