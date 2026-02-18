import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const mockGetSetting = vi.fn((key: string) =>
  key === 'Comfy.Queue.QPOV2' ? true : undefined
)
const mockSetSetting = vi.fn()

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting,
    set: mockSetSetting
  })
}))

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
          queuedSuffix: 'queued',
          clearQueued: 'Clear queued',
          moreOptions: 'More options',
          clearHistory: 'Clear history',
          dockedJobHistory: 'Docked Job History'
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
      queuedCount: 3,
      ...props
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
    }
  })

describe('QueueOverlayHeader', () => {
  beforeEach(() => {
    popoverToggleSpy.mockClear()
    popoverHideSpy.mockClear()
    mockSetSetting.mockClear()
  })

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

  it('shows queued summary and emits clear queued', async () => {
    const wrapper = mountHeader({ queuedCount: 4 })

    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('queued')

    const clearQueuedButton = wrapper.get('button[aria-label="Clear queued"]')
    await clearQueuedButton.trigger('click')
    expect(wrapper.emitted('clearQueued')).toHaveLength(1)
  })

  it('hides clear queued button when queued count is zero', () => {
    const wrapper = mountHeader({ queuedCount: 0 })

    expect(wrapper.find('button[aria-label="Clear queued"]').exists()).toBe(
      false
    )
  })

  it('toggles popover and emits clear history', async () => {
    const spy = vi.spyOn(tooltipConfig, 'buildTooltipConfig')

    const wrapper = mountHeader()

    const moreButton = wrapper.get('button[aria-label="More options"]')
    await moreButton.trigger('click')
    expect(popoverToggleSpy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('More')

    const clearHistoryButton = wrapper.get(
      '[data-testid="clear-history-action"]'
    )
    await clearHistoryButton.trigger('click')
    expect(popoverHideSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('clearHistory')).toHaveLength(1)
  })

  it('toggles docked job history setting from the menu', async () => {
    const wrapper = mountHeader()

    const moreButton = wrapper.get('button[aria-label="More options"]')
    await moreButton.trigger('click')

    const dockedJobHistoryButton = wrapper.get(
      '[data-testid="docked-job-history-action"]'
    )
    await dockedJobHistoryButton.trigger('click')

    expect(mockSetSetting).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith('Comfy.Queue.QPOV2', false)
  })
})
