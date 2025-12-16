import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueOverlayHeader from './QueueOverlayHeader.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          running: 'running'
        }
      }
    }
  }
})

const mountHeader = (props = {}) =>
  mount(QueueOverlayHeader, {
    props: {
      headerTitle: 'Job queue',
      showConcurrentIndicator: true,
      concurrentWorkflowCount: 2,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })

describe('QueueOverlayHeader', () => {
  it('renders header title and concurrent indicator when enabled', () => {
    const wrapper = mountHeader({ concurrentWorkflowCount: 3 })

    expect(wrapper.text()).toContain('Job queue')
    const indicator = wrapper.find('.inline-flex.items-center.gap-1')
    expect(indicator.exists()).toBe(true)
    expect(indicator.text()).toContain('3')
    expect(indicator.text()).toContain('running')
  })

  it('hides concurrent indicator when flag is false', () => {
    const wrapper = mountHeader({ showConcurrentIndicator: false })

    expect(wrapper.text()).toContain('Job queue')
    expect(wrapper.find('.inline-flex.items-center.gap-1').exists()).toBe(false)
  })
})
