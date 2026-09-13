import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

import ManagerProgressToast from './ManagerProgressToast.vue'

vi.mock<unknown>(
  import('@/workbench/extensions/manager/services/comfyManagerService'),
  () => ({
    useComfyManagerService: () => ({
      listInstalledPacks: vi.fn(async () => ({}))
    })
  })
)

vi.mock(
  import('@/workbench/extensions/manager/composables/useApplyChanges'),
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

const renderExpanded = async () => {
  const user = userEvent.setup()
  render(ManagerProgressToast, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
  await user.click(screen.getByRole('button', { name: 'Expand' }))
  return user
}

it('keeps a log collapsed across updates without collapsing another task', async () => {
  const store = useComfyManagerStore()
  const first = { taskId: 'first', taskName: 'First task', logs: ['Starting'] }
  const second = { taskId: 'second', taskName: 'Second task', logs: ['Queued'] }
  store.isProcessingTasks = true
  store.taskLogs = [first, second]
  store.succeededTasksLogs = [first, second]
  const user = await renderExpanded()

  const [disclosure, otherDisclosure] = screen.getAllByRole('group')
  expect(disclosure).toHaveAttribute('open')
  await user.click(within(disclosure).getByText('First task'))
  expect(disclosure).not.toHaveAttribute('open')

  store.succeededTasksLogs = [second, { ...first, logs: ['Starting', 'Done'] }]
  await nextTick()

  expect(screen.getAllByRole('group')).toEqual([otherDisclosure, disclosure])
  expect(within(disclosure).getByText('Done')).toBeInTheDocument()
  expect(disclosure).not.toHaveAttribute('open')
  expect(otherDisclosure).toHaveAttribute('open')
})

describe('failed tab indicator', () => {
  const renderWithFailures = async (failedTasksIds: string[]) => {
    const store = useComfyManagerStore()
    store.isProcessingTasks = true
    store.taskLogs = [{ taskId: 'a', taskName: 'A task', logs: ['Starting'] }]
    store.failedTasksIds = failedTasksIds
    await renderExpanded()
    return screen.getByRole('menubar')
  }

  it('leaves the Failed tab untitled when nothing has failed', async () => {
    const tablist = await renderWithFailures([])

    expect(within(tablist).getByText('Failed')).toBeInTheDocument()
    expect(within(tablist).queryByTitle(/installations? failed/)).toBeNull()
  })

  it('titles the Failed tab with the singular count for one failure', async () => {
    const tablist = await renderWithFailures(['task-1'])

    expect(
      within(tablist).getByTitle('1 installation failed')
    ).toHaveAccessibleName('Failed — 1 installation failed')
  })

  it('titles the Failed tab with the plural count for several failures', async () => {
    const tablist = await renderWithFailures(['task-1', 'task-2', 'task-3'])

    expect(
      within(tablist).getByTitle('3 installations failed')
    ).toHaveAccessibleName('Failed — 3 installations failed')
  })
})
