import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', async () => {
  const { reactive } = await import('vue')
  const succeeded = { taskName: 'Installed task', taskId: 'ok', logs: ['ok'] }
  const failed = { taskName: 'Failed task', taskId: 'failed', logs: ['failed'] }
  const store = reactive({
    taskLogs: [succeeded, failed],
    succeededTasksLogs: [succeeded],
    failedTasksLogs: [failed],
    succeededTasksIds: ['ok'],
    failedTasksIds: ['failed'],
    isProcessingTasks: true,
    taskQueue: { history: {}, running_queue: [], pending_queue: [] },
    taskHistory: {},
    resetTaskState: vi.fn()
  })
  return { useComfyManagerStore: () => store }
})

vi.mock(
  '@/workbench/extensions/manager/composables/useApplyChanges',
  async () => {
    const { ref } = await import('vue')
    return {
      useApplyChanges: () => ({
        isRestarting: ref(false),
        isRestartCompleted: ref(false),
        applyChanges: vi.fn()
      })
    }
  }
)

import ManagerProgressToast from './ManagerProgressToast.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      contextMenu: { Expand: 'Expand', Collapse: 'Collapse' },
      g: {
        close: 'Close',
        completedWithCheckmark: 'Completed',
        inProgress: 'In progress',
        progressCountOf: 'of'
      },
      manager: {
        applyChanges: 'Apply changes',
        failed: 'Failed ({count})',
        installationQueue: 'Installation queue',
        restartToApplyChanges: 'Restart to apply changes'
      }
    }
  }
})

describe('ManagerProgressToast', () => {
  it('supports roving keyboard focus between log tabs', async () => {
    render(ManagerProgressToast, { global: { plugins: [i18n] } })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    const queueTab = screen.getByRole('tab', { name: 'Installation queue' })
    const failedTab = screen.getByRole('tab', { name: 'Failed (1)' })

    expect(queueTab).toHaveAttribute('aria-controls')
    await user.click(queueTab)
    await user.keyboard('{ArrowRight}')

    expect(failedTab).toHaveFocus()
    expect(failedTab).toHaveAttribute('aria-selected', 'true')
    expect(failedTab).toHaveAttribute('tabindex', '0')
    expect(queueTab).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Failed task')
  })
})
