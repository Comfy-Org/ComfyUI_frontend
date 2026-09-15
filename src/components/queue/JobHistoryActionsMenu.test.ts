import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'
import { popoverCloseSpy } from '@/components/ui/__mocks__/popoverMockState'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

vi.mock(import('@/components/ui/Popover.vue'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

const renderMenu = () =>
  render(JobHistoryActionsMenu, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

describe('JobHistoryActionsMenu', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    useSidebarTabStore().activeSidebarTabId = null
    useSettingStore().$patch({
      settingValues: {
        'Comfy.Queue.QPOV2': true,
        'Comfy.Queue.ShowRunProgressBar': true
      }
    })
    vi.mocked(useSettingStore().set).mockResolvedValue(undefined)
    vi.mocked(useSettingStore().setMany).mockResolvedValue(undefined)
  })

  it('toggles show run progress bar setting from the menu', async () => {
    const user = userEvent.setup()

    renderMenu()

    await user.click(screen.getByTestId('show-run-progress-bar-action'))

    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledWith(
      'Comfy.Queue.ShowRunProgressBar',
      false
    )
  })

  it('opens docked job history sidebar when enabling from the menu', async () => {
    const user = userEvent.setup()
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    renderMenu()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledWith(
      'Comfy.Queue.QPOV2',
      true
    )
    expect(vi.mocked(useSettingStore().setMany)).not.toHaveBeenCalled()
    expect(useSidebarTabStore().activeSidebarTabId).toBe('job-history')
  })

  it('emits clear history from the menu', async () => {
    const user = userEvent.setup()
    const clearHistorySpy = vi.fn()

    render(JobHistoryActionsMenu, {
      props: { onClearHistory: clearHistorySpy },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    await user.click(screen.getByTestId('clear-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(clearHistorySpy).toHaveBeenCalledOnce()
  })
})
