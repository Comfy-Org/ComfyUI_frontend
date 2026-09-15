import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { popoverCloseSpy } from '@/components/ui/__mocks__/popoverMockState'
import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import QueueOverlayHeader from './QueueOverlayHeader.vue'

vi.mock(import('@/components/ui/Popover.vue'))

const tooltipDirectiveStub = {
  mounted: vi.fn(),
  updated: vi.fn()
}

const renderHeader = (props = {}) =>
  render(QueueOverlayHeader, {
    props: {
      headerTitle: 'Job queue',
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

  it('renders header title', () => {
    renderHeader()
    expect(screen.getByText('Job queue')).toBeInTheDocument()
  })

  it('shows clear queue text and emits clear queued', async () => {
    const user = userEvent.setup()
    const clearQueuedSpy = vi.fn()

    renderHeader({ queuedCount: 4, onClearQueued: clearQueuedSpy })

    expect(screen.getByText('Clear queue')).toBeInTheDocument()
    expect(screen.queryByText('4 queued')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear queued' }))
    expect(clearQueuedSpy).toHaveBeenCalledOnce()
  })

  it('disables clear queued button when queued count is zero', () => {
    renderHeader({ queuedCount: 0 })

    expect(screen.getByRole('button', { name: 'Clear queued' })).toBeDisabled()
    expect(screen.getByText('Clear queue')).toBeInTheDocument()
  })

  it('emits clear history from the menu', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(tooltipConfig, 'buildTooltipConfig')
    const clearHistorySpy = vi.fn()

    renderHeader({ onClearHistory: clearHistorySpy })

    expect(
      screen.getByRole('button', { name: 'More options' })
    ).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('More')

    await user.click(screen.getByTestId('clear-history-action'))
    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(clearHistorySpy).toHaveBeenCalledOnce()
  })

  it('opens floating queue progress overlay when disabling from the menu', async () => {
    const user = userEvent.setup()

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().setMany)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().setMany)).toHaveBeenCalledWith({
      'Comfy.Queue.QPOV2': false,
      'Comfy.Queue.History.Expanded': true
    })
    expect(vi.mocked(useSettingStore().set)).not.toHaveBeenCalled()
    expect(useSidebarTabStore().activeSidebarTabId).toBe(null)
  })

  it('opens docked job history sidebar when enabling from the menu', async () => {
    const user = userEvent.setup()
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    renderHeader()

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

  it('keeps docked target open even when enabling persistence fails', async () => {
    const user = userEvent.setup()
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false
    vi.mocked(useSettingStore().set).mockRejectedValueOnce(
      new Error('persistence failed')
    )

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledWith(
      'Comfy.Queue.QPOV2',
      true
    )
    expect(useSidebarTabStore().activeSidebarTabId).toBe('job-history')
  })

  it('closes the menu when disabling persistence fails', async () => {
    const user = userEvent.setup()
    vi.mocked(useSettingStore().setMany).mockRejectedValueOnce(
      new Error('persistence failed')
    )

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().setMany)).toHaveBeenCalledWith({
      'Comfy.Queue.QPOV2': false,
      'Comfy.Queue.History.Expanded': true
    })
  })

  it('toggles show run progress bar setting from the menu', async () => {
    const user = userEvent.setup()

    renderHeader()

    await user.click(screen.getByTestId('show-run-progress-bar-action'))

    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useSettingStore().set)).toHaveBeenCalledWith(
      'Comfy.Queue.ShowRunProgressBar',
      false
    )
  })
})
