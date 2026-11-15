import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'

import { i18n } from '@/i18n'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import QueueControls from './QueueControls.vue'

function pendingTask(id: string) {
  return new TaskItemImpl({
    id,
    status: 'pending',
    create_time: 0,
    priority: 0
  })
}

function renderControls(queueOverlayExpanded = false) {
  return render(QueueControls, {
    props: { queueOverlayExpanded },
    global: { plugins: [i18n] }
  })
}

describe('QueueControls', () => {
  it('interrupts the active job and disables interrupt when no job is active', async () => {
    const executionStore = useExecutionStore()
    executionStore.activeJobId = 'active-job'
    const execute = vi
      .spyOn(useCommandStore(), 'execute')
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderControls()

    await user.click(screen.getByRole('button', { name: 'Cancel current run' }))

    expect(execute).toHaveBeenCalledWith('Comfy.Interrupt', {
      metadata: { jobId: 'active-job' }
    })
    executionStore.activeJobId = null
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Cancel current run' })
      ).toBeDisabled()
    )
  })

  it('toggles job history with the queue panel enabled', async () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true
    const sidebarStore = useSidebarTabStore()
    const user = userEvent.setup()
    renderControls()

    await user.click(screen.getByTestId('queue-overlay-toggle'))

    expect(sidebarStore.activeSidebarTabId).toBe('job-history')
    expect(screen.getByTestId('queue-overlay-toggle')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(screen.getByTestId('queue-overlay-toggle'))
    expect(sidebarStore.activeSidebarTabId).toBeNull()
  })

  it('toggles the legacy overlay and reflects its expanded prop', async () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false
    const execute = vi
      .spyOn(useCommandStore(), 'execute')
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderControls(true)

    expect(screen.getByTestId('queue-overlay-toggle')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(screen.getByTestId('queue-overlay-toggle'))
    expect(execute).toHaveBeenCalledWith('Comfy.Queue.ToggleOverlay')
  })

  it('clears pending jobs through the registered command', async () => {
    const queueStore = useQueueStore()
    queueStore.pendingTasks = [pendingTask('pending-job')]
    const execute = vi
      .spyOn(useCommandStore(), 'execute')
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderControls()

    await fireEvent.contextMenu(screen.getByTestId('queue-overlay-toggle'))
    await user.click(
      await screen.findByText(
        i18n.global.t('sideToolbar.queueProgressOverlay.clearQueueTooltip')
      )
    )

    expect(execute).toHaveBeenCalledWith('Comfy.ClearPendingTasks')
  })
})
