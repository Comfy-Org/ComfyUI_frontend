import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
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

it('keeps a log collapsed across updates without collapsing another task', async () => {
  const store = useComfyManagerStore()
  const first = { taskId: 'first', taskName: 'First task', logs: ['Starting'] }
  const second = { taskId: 'second', taskName: 'Second task', logs: ['Queued'] }
  store.isProcessingTasks = true
  store.taskLogs = [first, second]
  store.succeededTasksLogs = [first, second]
  const user = userEvent.setup()
  render(ManagerProgressToast, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
  await user.click(screen.getByRole('button', { name: 'Expand' }))

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
