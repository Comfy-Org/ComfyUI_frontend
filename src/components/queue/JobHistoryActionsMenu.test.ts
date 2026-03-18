import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { i18n } from '@/i18n'
import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'

const popoverCloseSpy = vi.fn()

vi.mock('@/components/ui/Popover.vue', () => {
  const PopoverStub = defineComponent({
    name: 'Popover',
    setup(_, { slots }) {
      return () =>
        h('div', [
          slots.button?.(),
          slots.default?.({
            close: () => {
              popoverCloseSpy()
            }
          })
        ])
    }
  })
  return { default: PopoverStub }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const mockGetSetting = vi.fn<(key: string) => boolean | undefined>((key) =>
  key === 'Comfy.Queue.QPOV2' || key === 'Comfy.Queue.ShowRunProgressBar'
    ? true
    : undefined
)
const mockSetSetting = vi.fn()
const mockSetMany = vi.fn()
const mockSidebarTabStore = {
  activeSidebarTabId: null as string | null
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting,
    set: mockSetSetting,
    setMany: mockSetMany
  })
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => mockSidebarTabStore
}))

const mountMenu = () =>
  mount(JobHistoryActionsMenu, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

describe('JobHistoryActionsMenu', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    popoverCloseSpy.mockClear()
    mockSetSetting.mockClear()
    mockSetMany.mockClear()
    mockSidebarTabStore.activeSidebarTabId = null
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' || key === 'Comfy.Queue.ShowRunProgressBar'
        ? true
        : undefined
    )
  })

  it('toggles show run progress bar setting from the menu', async () => {
    const wrapper = mountMenu()

    const showRunProgressBarButton = wrapper.get(
      '[data-testid="show-run-progress-bar-action"]'
    )
    await showRunProgressBarButton.trigger('click')

    expect(mockSetSetting).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith(
      'Comfy.Queue.ShowRunProgressBar',
      false
    )
  })

  it('opens docked job history sidebar when enabling from the menu', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'Comfy.Queue.QPOV2') return false
      if (key === 'Comfy.Queue.ShowRunProgressBar') return true
      return undefined
    })
    const wrapper = mountMenu()

    const dockedJobHistoryButton = wrapper.get(
      '[data-testid="docked-job-history-action"]'
    )
    await dockedJobHistoryButton.trigger('click')

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith('Comfy.Queue.QPOV2', true)
    expect(mockSetMany).not.toHaveBeenCalled()
    expect(mockSidebarTabStore.activeSidebarTabId).toBe('job-history')
  })

  it('emits clear history from the menu', async () => {
    const wrapper = mountMenu()

    const clearHistoryButton = wrapper.get(
      '[data-testid="clear-history-action"]'
    )
    await clearHistoryButton.trigger('click')

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('clearHistory')).toHaveLength(1)
  })
})
