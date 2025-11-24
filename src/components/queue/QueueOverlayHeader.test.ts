import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'

const popoverToggleSpy = vi.fn()
const popoverHideSpy = vi.fn()

vi.mock('primevue/popover', () => {
  const PopoverStub = defineComponent({
    name: 'Popover',
    setup(_, { slots, expose }) {
      const toggle = (event: Event) => {
        popoverToggleSpy(event)
      }
      const hide = () => {
        popoverHideSpy()
      }
      expose({ toggle, hide })
      return () => slots.default?.()
    }
  })
  return { default: PopoverStub }
})

import QueueOverlayHeader from './QueueOverlayHeader.vue'
import * as tooltipConfig from '@/composables/useTooltipConfig'

const tooltipDirectiveStub = {
  mounted: vi.fn(),
  updated: vi.fn()
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { more: 'More' },
      sideToolbar: {
        queueProgressOverlay: {
          running: 'running',
          moreOptions: 'More options',
          clearHistory: 'Clear history'
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
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
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

  it('toggles popover and emits clear history', async () => {
    const spy = vi.spyOn(tooltipConfig, 'buildTooltipConfig')

    const wrapper = mountHeader()

    const moreButton = wrapper.get('button[aria-label="More options"]')
    await moreButton.trigger('click')
    expect(popoverToggleSpy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('More')

    const clearHistoryButton = wrapper.get('button[aria-label="Clear history"]')
    await clearHistoryButton.trigger('click')
    expect(popoverHideSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('clearHistory')).toHaveLength(1)
  })
})
