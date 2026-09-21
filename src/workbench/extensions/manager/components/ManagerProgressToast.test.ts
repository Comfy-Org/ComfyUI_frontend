import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { api } from '@/scripts/api'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { components } from '@/workbench/extensions/manager/types/generatedManagerTypes'

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

it('offers startup retry while keeping accepted tasks pending', async () => {
  const store = useComfyManagerStore()
  store.queueError = 'Queue start temporarily unavailable'
  vi.spyOn(store, 'isProcessingTasks', 'get').mockReturnValue(true)
  const log = { taskId: 'pending', taskName: 'Installing pack', logs: [] }
  store.taskLogs = [log]
  store.succeededTasksLogs = [log]
  store.taskQueue.pending_queue = [
    {
      ui_id: log.taskId,
      client_id: 'test-client',
      kind: 'install',
      params: {
        id: 'pending-pack',
        version: '1.0.0',
        selected_version: '1.0.0',
        mode: 'cache',
        channel: 'default'
      }
    }
  ]
  render(ManagerProgressToast, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
  expect(
    screen.getByText('Tasks are pending. Retry to continue.')
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: 'Apply Changes' })
  ).not.toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Expand' }))
  expect(
    screen.queryByText(en.g.completedWithCheckmark)
  ).not.toBeInTheDocument()
  const retry = vi.spyOn(store, 'startQueue').mockResolvedValue(undefined)
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('shows failed installations without suggesting a successful change', async () => {
  const store = useComfyManagerStore()
  const log = {
    taskId: 'failed',
    taskName: 'Installing sweet-tea-nodes',
    logs: ['Denied']
  }
  store.taskLogs = [log]
  store.failedTasksIds = ['failed']
  store.failedTasksLogs = [log]
  render(ManagerProgressToast, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(
    screen.queryByText(en.manager.restartToApplyChanges)
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Apply Changes' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('Failed')).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Expand' }))
  await user.click(screen.getByRole('menuitem', { name: 'Failed' }))
  expect(screen.getByText('Denied')).toBeInTheDocument()
  expect(
    screen.queryByText(en.g.completedWithCheckmark)
  ).not.toBeInTheDocument()
})

it.for([[], ['failed']])(
  'keeps Apply Changes available when a task succeeded (%j failures)',
  (failedIds) => {
    const store = useComfyManagerStore()
    store.taskLogs = [
      { taskId: 'success', taskName: 'Installing pack', logs: [] }
    ]
    store.succeededTasksIds = ['success']
    store.failedTasksIds = failedIds
    render(ManagerProgressToast, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
      }
    })
    expect(
      screen.getByText(en.manager.restartToApplyChanges)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply Changes' })).toBeEnabled()
  }
)

it('keeps a log collapsed across updates without collapsing another task', async () => {
  const store = useComfyManagerStore()
  const first = { taskId: 'first', taskName: 'First task', logs: ['Starting'] }
  const second = { taskId: 'second', taskName: 'Second task', logs: ['Queued'] }
  vi.spyOn(store, 'isProcessingTasks', 'get').mockReturnValue(true)
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

it('finishes an empty batch without an error or restart action', () => {
  const store = useComfyManagerStore()
  store.taskLogs = [
    { taskId: 'empty', taskName: 'Updating all packs', logs: [] }
  ]
  render(ManagerProgressToast, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
  expect(screen.getByText(en.g.completed)).toBeVisible()
  expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Apply Changes' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
})

it.for([
  { name: 'the queue is idle', pendingQueue: [] },
  {
    name: 'another request is pending',
    pendingQueue: [
      {
        ui_id: 'pending',
        client_id: 'test-client',
        kind: 'enable',
        params: { cnr_id: 'pending-pack' }
      }
    ] satisfies components['schemas']['QueueTaskItem'][]
  }
])(
  'shows an Update All failure without mislabeling other logs when $name',
  async ({ pendingQueue }) => {
    const previousClientId = api.clientId
    api.clientId = 'test-client'
    onTestFinished(() => {
      api.clientId = previousClientId
    })
    const store = useComfyManagerStore()
    store.taskLogs = [
      {
        taskId: 'batch',
        taskName: 'Updating all packs',
        logs: ['Update denied']
      },
      { taskId: 'bat', taskName: 'Enabling another pack', logs: [] }
    ]
    const failedTask: components['schemas']['TaskHistoryItem'] = {
      ui_id: 'batch_pack',
      client_id: 'test-client',
      kind: 'update',
      result: 'Update denied',
      status: { status_str: 'error', completed: true, messages: [] },
      timestamp: '2026-09-19T00:00:00Z'
    }
    const successfulTask: components['schemas']['TaskHistoryItem'] = {
      ui_id: 'bat',
      client_id: failedTask.client_id,
      kind: 'enable',
      result: 'Enabled',
      status: { status_str: 'success', completed: true, messages: [] },
      timestamp: failedTask.timestamp
    }
    const completion: components['schemas']['MessageTaskDone'] = {
      ui_id: failedTask.ui_id,
      kind: failedTask.kind,
      result: failedTask.result,
      status: failedTask.status,
      timestamp: failedTask.timestamp,
      state: {
        running_queue: [],
        pending_queue: pendingQueue,
        installed_packs: {},
        history: {
          [failedTask.ui_id]: failedTask,
          [successfulTask.ui_id]: successfulTask
        }
      }
    }
    render(ManagerProgressToast, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
      }
    })
    api.dispatchCustomEvent('cm-task-completed', completion)
    await nextTick()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(
      within(screen.getByRole('group')).getByText('Enabling another pack')
    ).toBeVisible()
    expect(screen.queryByText('Updating all packs')).not.toBeInTheDocument()
    expect(screen.getByText(en.g.completedWithCheckmark)).toBeVisible()
    await user.click(screen.getByRole('menuitem', { name: 'Failed' }))
    expect(screen.getByText('Updating all packs')).toBeVisible()
    expect(screen.getByText('Update denied')).toBeVisible()
    expect(
      within(screen.getByRole('group')).getByText(en.g.failed)
    ).toBeVisible()
    expect(
      within(screen.getByRole('group')).queryByText('Enabling another pack')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(en.g.completedWithCheckmark)
    ).not.toBeInTheDocument()
  }
)

it.for([
  {
    name: 'all children completed',
    historyIds: ['batch_pack'],
    runningIds: ['batching'],
    pendingIds: [],
    expectedStatus: en.g.completedWithCheckmark
  },
  {
    name: 'the batch is empty',
    historyIds: [],
    runningIds: ['batching'],
    pendingIds: [],
    expectedStatus: en.g.completedWithCheckmark
  },
  {
    name: 'another child is still pending',
    historyIds: ['batch_pack'],
    runningIds: ['batching'],
    pendingIds: ['batch_next'],
    expectedStatus: en.g.inProgress
  },
  {
    name: 'another child is still running',
    historyIds: ['batch_pack'],
    runningIds: ['batch_next'],
    pendingIds: ['batching'],
    expectedStatus: en.g.inProgress
  }
])(
  'shows request-specific progress during unrelated work when $name',
  async ({ historyIds, runningIds, pendingIds, expectedStatus }) => {
    const previousClientId = api.clientId
    api.clientId = 'test-client'
    onTestFinished(() => {
      api.clientId = previousClientId
    })
    const store = useComfyManagerStore()
    store.taskLogs = [
      { taskId: 'batch', taskName: 'Updating all packs', logs: [] }
    ]
    function queueTask(ui_id: string): components['schemas']['QueueTaskItem'] {
      return {
        ui_id,
        client_id: 'test-client',
        kind: 'update',
        params: { node_name: ui_id, node_ver: '1.0.0' }
      }
    }
    const state: components['schemas']['TaskStateMessage'] = {
      running_queue: runningIds.map(queueTask),
      pending_queue: pendingIds.map(queueTask),
      installed_packs: {},
      history: Object.fromEntries(
        historyIds.map(
          (ui_id): [string, components['schemas']['TaskHistoryItem']] => [
            ui_id,
            {
              ui_id,
              client_id: 'test-client',
              kind: 'update',
              result: 'Updated',
              status: { status_str: 'success', completed: true, messages: [] },
              timestamp: '2026-09-19T04:00:00Z'
            }
          ]
        )
      )
    }
    render(ManagerProgressToast, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
      }
    })
    api.dispatchCustomEvent('cm-task-started', {
      ui_id: state.running_queue[0].ui_id,
      kind: state.running_queue[0].kind,
      timestamp: '2026-09-19T04:01:00Z',
      state
    })
    await nextTick()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Expand' }))
    expect(
      within(screen.getByRole('group')).getByText(expectedStatus)
    ).toBeVisible()
  }
)
