import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { i18n } from '@/i18n'

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

import QueueOverlayHeader from './QueueOverlayHeader.vue'

const BaseTooltipStub = {
  template: '<slot />'
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
      stubs: {
        BaseTooltip: BaseTooltipStub
      }
    }
  })

describe('QueueOverlayHeader', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    popoverCloseSpy.mockClear()
    mockSetSetting.mockClear()
    mockSetMany.mockClear()
    mockSidebarTabStore.activeSidebarTabId = null
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
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
    const clearHistorySpy = vi.fn()

    renderHeader({ onClearHistory: clearHistorySpy })

    expect(
      screen.getByRole('button', { name: 'More options' })
    ).toBeInTheDocument()

    await user.click(screen.getByTestId('clear-history-action'))
    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(clearHistorySpy).toHaveBeenCalledOnce()
  })

  it('opens floating queue progress overlay when disabling from the menu', async () => {
    const user = userEvent.setup()

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(mockSetMany).toHaveBeenCalledTimes(1)
    expect(mockSetMany).toHaveBeenCalledWith({
      'Comfy.Queue.QPOV2': false,
      'Comfy.Queue.History.Expanded': true
    })
    expect(mockSetSetting).not.toHaveBeenCalled()
    expect(mockSidebarTabStore.activeSidebarTabId).toBe(null)
  })

  it('opens docked job history sidebar when enabling from the menu', async () => {
    const user = userEvent.setup()
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith('Comfy.Queue.QPOV2', true)
    expect(mockSetMany).not.toHaveBeenCalled()
    expect(mockSidebarTabStore.activeSidebarTabId).toBe('job-history')
  })

  it('keeps docked target open even when enabling persistence fails', async () => {
    const user = userEvent.setup()
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )
    mockSetSetting.mockRejectedValueOnce(new Error('persistence failed'))

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith('Comfy.Queue.QPOV2', true)
    expect(mockSidebarTabStore.activeSidebarTabId).toBe('job-history')
  })

  it('closes the menu when disabling persistence fails', async () => {
    const user = userEvent.setup()
    mockSetMany.mockRejectedValueOnce(new Error('persistence failed'))

    renderHeader()

    await user.click(screen.getByTestId('docked-job-history-action'))

    expect(popoverCloseSpy).toHaveBeenCalledTimes(1)
    expect(mockSetMany).toHaveBeenCalledWith({
      'Comfy.Queue.QPOV2': false,
      'Comfy.Queue.History.Expanded': true
    })
  })

  it('toggles show run progress bar setting from the menu', async () => {
    const user = userEvent.setup()

    renderHeader()

    await user.click(screen.getByTestId('show-run-progress-bar-action'))

    expect(mockSetSetting).toHaveBeenCalledTimes(1)
    expect(mockSetSetting).toHaveBeenCalledWith(
      'Comfy.Queue.ShowRunProgressBar',
      false
    )
  })
})
