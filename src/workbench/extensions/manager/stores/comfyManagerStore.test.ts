import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useToast } from '@/components/ui/toast'
import { api } from '@/scripts/api'
import * as registryService from '@/services/comfyRegistryService'
import type { components as RegistryComponents } from '@/types/comfyRegistryTypes'
import PackUpdateButton from '@/workbench/extensions/manager/components/manager/button/PackUpdateButton.vue'
import ManagerProgressToast from '@/workbench/extensions/manager/components/ManagerProgressToast.vue'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type InstalledPacksResponse =
  ManagerComponents['schemas']['InstalledPacksResponse']
type ManagerPackInstalled = ManagerComponents['schemas']['ManagerPackInstalled']
type TaskExecutionStatus = ManagerComponents['schemas']['TaskExecutionStatus']

function legacyToastMessages() {
  return useToast().toasts.flatMap((toast) =>
    toast.kind === 'custom'
      ? []
      : [
          {
            severity: toast.kind === 'warning' ? 'warn' : toast.kind,
            summary: toast.title,
            ...(toast.description ? { detail: toast.description } : {}),
            ...(Number.isFinite(toast.duration) ? { life: toast.duration } : {})
          }
        ]
  )
}

vi.mock(
  import('@/workbench/extensions/manager/services/comfyManagerService'),

  () => ({
    useComfyManagerService: vi.fn()
  })
)

vi.mock(import('@/composables/useServerLogs'), () => ({
  useServerLogs: () => ({
    startListening: vi.fn(),
    stopListening: vi.fn(),
    logs: ref([])
  })
}))

vi.mock(
  import('@/workbench/extensions/manager/composables/useApplyChanges'),
  () => ({
    useApplyChanges: () => ({
      isRestarting: ref(false),
      isRestartCompleted: ref(false),
      applyChanges: vi.fn()
    })
  })
)

interface EnabledDisabledTestCase {
  desc: string
  installed: Record<string, ManagerPackInstalled>
  expectState: 'enabled' | 'disabled'
  /** @default 'name' */
  packName?: string
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('useComfyManagerStore', () => {
  let mockManagerService: ReturnType<typeof useComfyManagerService>

  const triggerPacksChange = async (
    installedPacks: InstalledPacksResponse,
    store: ReturnType<typeof useComfyManagerStore>
  ) => {
    // Simulate change in value to properly trigger watchers. Required even for immediate watchers.
    store.installedPacks = {}
    await nextTick()
    store.installedPacks = installedPacks
  }

  beforeEach(() => {
    const previousClientId = api.clientId
    api.clientId = 'test-client'
    onTestFinished(() => {
      api.clientId = previousClientId
    })
    mockManagerService = {
      isLoading: ref(false),
      error: ref(null),
      startQueue: vi.fn().mockResolvedValue(''),
      getQueueStatus: vi.fn().mockResolvedValue({
        total_count: 1,
        done_count: 0,
        in_progress_count: 0,
        pending_count: 1,
        is_processing: false
      }),
      getTaskHistory: vi.fn().mockResolvedValue(null),
      listInstalledPacks: vi.fn().mockResolvedValue({}),
      getImportFailInfo: vi.fn().mockResolvedValue(null),
      getImportFailInfoBulk: vi.fn().mockResolvedValue({}),
      installPack: vi.fn().mockResolvedValue(''),
      uninstallPack: vi.fn().mockResolvedValue(''),
      enablePack: vi.fn().mockResolvedValue(''),
      disablePack: vi.fn().mockResolvedValue(''),
      updatePack: vi.fn().mockResolvedValue(''),
      updateAllPacks: vi.fn().mockResolvedValue(''),
      updateComfyUI: vi.fn().mockResolvedValue(''),
      rebootComfyUI: vi.fn().mockResolvedValue(null),
      isLegacyManagerUI: vi.fn().mockResolvedValue(false)
    }

    vi.mocked(useComfyManagerService).mockReturnValue(mockManagerService)
  })

  const noInstalledPacks: InstalledPacksResponse = {}
  const previousInstallation: InstalledPacksResponse = {
    'test-pack': { cnr_id: 'test-pack', ver: '1.0.0', enabled: true }
  }

  it.for([
    {
      name: 'Flagged denial',
      status: 'error',
      result:
        'This action is not allowed by the current security configuration. See the terminal for details.',
      initialInstalled: noInstalledPacks,
      installed: noInstalledPacks,
      expectedInstalled: false,
      expectedToasts: [
        expect.objectContaining({
          severity: 'error',
          detail:
            'This action is not allowed by the current security configuration. See the terminal for details.'
        })
      ]
    },
    {
      name: 'download failure',
      status: 'error',
      result: 'Download failed',
      initialInstalled: noInstalledPacks,
      installed: noInstalledPacks,
      expectedInstalled: false,
      expectedToasts: [
        expect.objectContaining({
          severity: 'error',
          detail: 'Download failed'
        })
      ]
    },
    {
      name: 'failed version switch',
      status: 'error',
      result: 'Version installation denied',
      initialInstalled: previousInstallation,
      installed: previousInstallation,
      expectedInstalled: true,
      expectedToasts: [
        expect.objectContaining({
          severity: 'error',
          detail: 'Version installation denied'
        })
      ]
    },
    {
      name: 'successful installation',
      status: 'success',
      result: 'success',
      initialInstalled: noInstalledPacks,
      installed: {
        'test-pack': { cnr_id: 'test-pack', ver: '2.0.0', enabled: true }
      },
      expectedInstalled: true,
      expectedToasts: []
    }
  ] as const)(
    'handles $name on task completion',
    async ({
      status,
      result,
      initialInstalled,
      installed,
      expectedInstalled,
      expectedToasts
    }) => {
      const store = useComfyManagerStore()
      await store.refreshInstalledList()
      store.installedPacks = initialInstalled
      await nextTick()
      await store.installPack.call({
        id: 'test-pack',
        mode: 'cache',
        channel: 'default',
        version: '2.0.0',
        selected_version: '2.0.0'
      })
      expect(store.isPackInstalling('test-pack')).toBe(true)
      const taskId = vi.mocked(mockManagerService.installPack).mock.calls[0][1]
      assert.isDefined(taskId)
      const taskStatus = {
        status_str: status,
        completed: true,
        messages: [result]
      }
      const detail: ManagerComponents['schemas']['MessageTaskDone'] = {
        ui_id: taskId,
        kind: 'install',
        result,
        status: taskStatus,
        timestamp: '2026-09-19T00:00:00Z',
        state: {
          installed_packs: installed,
          running_queue: [],
          pending_queue: [],
          history: {
            [taskId]: {
              ui_id: taskId,
              client_id: 'test-client',
              kind: 'install',
              result,
              status: taskStatus,
              timestamp: '2026-09-19T00:00:00Z'
            }
          }
        }
      }
      api.dispatchCustomEvent('cm-task-completed', detail)
      await nextTick()

      expect(store.isPackInstalling('test-pack')).toBe(false)
      expect(store.isPackInstalled('test-pack')).toBe(expectedInstalled)
      expect(store.installedPacks).toEqual(installed)
      expect(store.isProcessingTasks).toBe(false)
      expect(legacyToastMessages()).toEqual(expectedToasts)

      api.dispatchCustomEvent('cm-task-completed', detail)
      expect(legacyToastMessages()).toEqual(expectedToasts)
    }
  )

  it('clears a rejected installation request and lets the user retry', async () => {
    vi.mocked(mockManagerService.installPack).mockImplementationOnce(
      async () => {
        mockManagerService.error.value = 'Request rejected. Check the terminal.'
        return null
      }
    )
    const store = useComfyManagerStore()
    const request: ManagerComponents['schemas']['InstallPackParams'] = {
      id: 'test-pack',
      mode: 'cache',
      channel: 'default',
      version: '2.0.0',
      selected_version: '2.0.0'
    }
    await store.installPack.call(request)

    expect(store.isPackInstalling('test-pack')).toBe(false)
    expect(store.isPackInstalled('test-pack')).toBe(false)
    expect(store.isProcessingTasks).toBe(false)
    expect(legacyToastMessages()).toEqual([
      expect.objectContaining({
        severity: 'error',
        detail: 'Request rejected. Check the terminal.'
      })
    ])
    expect(mockManagerService.startQueue).not.toHaveBeenCalled()

    await store.installPack.call(request)
    expect(mockManagerService.installPack).toHaveBeenCalledTimes(2)
    expect(store.isPackInstalling('test-pack')).toBe(true)
  })

  it('retains an accepted installation when startup fails and retries only startup', async () => {
    vi.mocked(mockManagerService.startQueue).mockImplementationOnce(
      async () => {
        mockManagerService.error.value = 'Queue start temporarily unavailable'
        return null
      }
    )
    const store = useComfyManagerStore()
    const request: ManagerComponents['schemas']['InstallPackParams'] = {
      id: 'test-pack',
      mode: 'cache',
      channel: 'default',
      version: '1.1.0',
      selected_version: '1.1.0'
    }
    await store.installPack.call(request)
    expect(store.isPackInstalling('test-pack')).toBe(true)
    expect(store.isProcessingTasks).toBe(true)
    expect(store.failedTasksIds).toEqual([])
    expect(legacyToastMessages()).toEqual([
      expect.objectContaining({ detail: 'Queue start temporarily unavailable' })
    ])

    await store.installPack.call(request)
    await store.startQueue()
    expect(mockManagerService.installPack).toHaveBeenCalledOnce()
    expect(mockManagerService.startQueue).toHaveBeenCalledTimes(2)
    expect(store.queueError).toBeNull()

    const taskId = vi.mocked(mockManagerService.installPack).mock.calls[0][1]
    assert.isDefined(taskId)
    const result = 'Installation denied. See the terminal for details.'
    const status: ManagerComponents['schemas']['TaskExecutionStatus'] = {
      status_str: 'error',
      completed: true,
      messages: [result]
    }
    const completion: ManagerComponents['schemas']['MessageTaskDone'] = {
      ui_id: taskId,
      kind: 'install',
      result,
      status,
      timestamp: '2026-09-19T00:00:00Z',
      state: {
        installed_packs: {},
        running_queue: [],
        pending_queue: [],
        history: {
          [taskId]: {
            ui_id: taskId,
            client_id: 'test-client',
            kind: 'install',
            result,
            status,
            timestamp: '2026-09-19T00:00:00Z'
          }
        }
      }
    }
    api.dispatchCustomEvent('cm-task-completed', completion)
    await nextTick()
    expect(store.isPackInstalling('test-pack')).toBe(false)
    expect(store.isPackInstalled('test-pack')).toBe(false)
    expect(store.isProcessingTasks).toBe(false)
    expect(legacyToastMessages().at(-1)).toEqual(
      expect.objectContaining({ severity: 'error', detail: result })
    )
  })

  it('keeps an accepted installation pending when another request is rejected', async () => {
    const store = useComfyManagerStore()
    await store.installPack.call({
      id: 'pending-pack',
      mode: 'cache',
      channel: 'default',
      version: '1.0.0',
      selected_version: '1.0.0'
    })
    vi.mocked(mockManagerService.installPack).mockImplementationOnce(
      async () => {
        mockManagerService.error.value = 'Request rejected'
        return null
      }
    )

    await store.installPack.call({
      id: 'rejected-pack',
      mode: 'cache',
      channel: 'default',
      version: '2.0.0',
      selected_version: '2.0.0'
    })

    expect(store.isPackInstalling('pending-pack')).toBe(true)
    expect(store.isPackInstalling('rejected-pack')).toBe(false)
    expect(store.isProcessingTasks).toBe(true)
    expect(legacyToastMessages()).toEqual([
      expect.objectContaining({ severity: 'error', detail: 'Request rejected' })
    ])
  })

  it('preserves a rejected request after another task completes', async () => {
    vi.mocked(mockManagerService.installPack).mockImplementationOnce(
      async () => {
        mockManagerService.error.value = 'Request rejected'
        return null
      }
    )
    const store = useComfyManagerStore()
    await store.installPack.call({
      id: 'rejected-pack',
      mode: 'cache',
      channel: 'default',
      version: '2.0.0',
      selected_version: '2.0.0'
    })
    await nextTick()
    const rejectedId = store.taskLogs[0].taskId
    expect(store.isTaskFailed(rejectedId)).toBe(true)

    await store.enablePack({ id: 'other-pack', version: '1.0.0' })
    const taskId = vi.mocked(mockManagerService.enablePack).mock.calls[0][1]
    assert.isDefined(taskId)
    const completed: ManagerComponents['schemas']['TaskHistoryItem'] = {
      ui_id: taskId,
      client_id: 'test-client',
      kind: 'enable',
      result: 'Enabled',
      timestamp: '2026-09-20T00:00:00Z',
      status: { status_str: 'success', completed: true, messages: [] }
    }
    api.dispatchCustomEvent('cm-task-completed', {
      ui_id: taskId,
      kind: completed.kind,
      result: completed.result,
      timestamp: completed.timestamp,
      status: completed.status,
      state: {
        installed_packs: {},
        running_queue: [],
        pending_queue: [],
        history: { [taskId]: completed }
      }
    })
    await nextTick()
    expect(store.isProcessingTasks).toBe(false)
    expect(store.isTaskFailed(rejectedId)).toBe(true)
    expect(store.failedTasksLogs.map((log) => log.taskId)).toContain(rejectedId)
    expect(store.succeededTasksIds).toEqual([taskId])
    store.resetTaskState()
    expect(store.failedTasksIds).toEqual([])
    expect(store.taskHistory).toEqual({})
  })

  it.for<{
    state: string
    installed: InstalledPacksResponse
  }>([
    {
      state: 'disabled',
      installed: {
        'pack-a': { cnr_id: 'pack-a', ver: '1.0.0', enabled: false }
      }
    },
    { state: 'uninstalled', installed: {} }
  ])(
    'does not update a pack $state during its version lookup',
    async ({ installed }) => {
      vi.mocked(mockManagerService.listInstalledPacks).mockResolvedValue({
        'pack-a': { cnr_id: 'pack-a', ver: '1.0.0', enabled: true }
      })
      const store = useComfyManagerStore()
      await store.refreshInstalledList()
      await nextTick()
      const versions =
        deferred<RegistryComponents['schemas']['NodeVersion'][]>()
      const registry = registryService.useComfyRegistryService()
      vi.spyOn(registry, 'getPackVersions').mockReturnValue(versions.promise)
      vi.spyOn(registryService, 'useComfyRegistryService').mockReturnValue(
        registry
      )

      const updating = store.updatePacks([{ id: 'pack-a' }])
      store.installedPacks = installed
      await nextTick()
      versions.resolve([
        { version: '1.1.0', status: 'NodeVersionStatusActive' }
      ])
      await updating

      expect(mockManagerService.installPack).not.toHaveBeenCalled()
      expect(store.isProcessingTasks).toBe(false)
    }
  )

  it('keeps Apply Changes hidden until Update All finishes preparing every pack', async () => {
    const installed: InstalledPacksResponse = {
      'pack-a': { cnr_id: 'pack-a', ver: '1.0.0', enabled: true },
      'pack-b': { cnr_id: 'pack-b', ver: '1.0.0', enabled: true }
    }
    vi.mocked(mockManagerService.listInstalledPacks).mockResolvedValue(
      installed
    )
    const store = useComfyManagerStore()
    await store.refreshInstalledList()
    await nextTick()
    const secondStarted = deferred<void>()
    const secondVersions =
      deferred<RegistryComponents['schemas']['NodeVersion'][]>()
    const getVersions = vi.fn(async (id: string | undefined) => {
      if (id === 'pack-b') {
        secondStarted.resolve()
        return secondVersions.promise
      }
      return [{ version: '1.1.0', status: 'NodeVersionStatusActive' as const }]
    })
    const registry = registryService.useComfyRegistryService()
    vi.spyOn(registry, 'getPackVersions').mockImplementation(getVersions)
    vi.spyOn(registryService, 'useComfyRegistryService').mockReturnValue(
      registry
    )
    const global = {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      directives: { tooltip: {} }
    }
    render(PackUpdateButton, {
      props: { nodePacks: [{ id: 'pack-a' }, { id: 'pack-b' }] },
      global
    })
    render(ManagerProgressToast, { global })
    await userEvent.click(screen.getByRole('button', { name: 'Update All' }))
    await secondStarted.promise
    const taskId = vi.mocked(mockManagerService.installPack).mock.calls[0][1]
    assert.isDefined(taskId)
    const completed: ManagerComponents['schemas']['TaskHistoryItem'] = {
      ui_id: taskId,
      client_id: 'test-client',
      kind: 'install',
      result: 'Done',
      timestamp: '2026-09-20T00:00:00Z',
      status: { status_str: 'success', completed: true, messages: [] }
    }
    api.dispatchCustomEvent('cm-task-completed', {
      ui_id: taskId,
      kind: completed.kind,
      result: completed.result,
      timestamp: completed.timestamp,
      status: completed.status,
      state: {
        installed_packs: installed,
        running_queue: [],
        pending_queue: [],
        history: { [taskId]: completed }
      }
    })
    await nextTick()
    try {
      expect(screen.getByRole('button', { name: 'Update All' })).toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Apply Changes' })
      ).not.toBeInTheDocument()
    } finally {
      secondVersions.resolve([])
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Update All' })).toBeEnabled()
      )
      expect(
        screen.getByRole('button', { name: 'Apply Changes' })
      ).toBeEnabled()
    }
  })

  const scenarios = [
    {
      method: 'updatePack',
      kind: 'update',
      taskSuffix: '',
      run: (store: ReturnType<typeof useComfyManagerStore>) =>
        store.updatePack.call({ id: 'pending-pack', version: '1.0.0' })
    },
    {
      method: 'updateAllPacks',
      kind: 'update',
      taskSuffix: '_pending-pack',
      run: (store: ReturnType<typeof useComfyManagerStore>) =>
        store.updateAllPacks.call({})
    },
    {
      method: 'enablePack',
      kind: 'enable',
      taskSuffix: '',
      run: (store: ReturnType<typeof useComfyManagerStore>) =>
        store.enablePack({ id: 'pending-pack', version: '1.0.0' })
    },
    {
      method: 'disablePack',
      kind: 'disable',
      taskSuffix: '',
      run: (store: ReturnType<typeof useComfyManagerStore>) =>
        store.disablePack({ id: 'pending-pack', version: '1.0.0' })
    }
  ] as const

  it.for(scenarios)(
    '$method failure reports its log and shows one toast',
    async ({ method, kind, taskSuffix, run }) => {
      const store = useComfyManagerStore()
      await run(store)
      const baseTaskId = vi.mocked(mockManagerService[method]).mock.calls[0][1]
      assert.isDefined(baseTaskId)
      const taskId = baseTaskId + taskSuffix
      const status: ManagerComponents['schemas']['TaskExecutionStatus'] = {
        status_str: 'error',
        completed: true,
        messages: ['Operation failed']
      }
      const historyItem: ManagerComponents['schemas']['TaskHistoryItem'] = {
        ui_id: taskId,
        client_id: 'test-client',
        kind,
        result: 'Operation failed',
        status,
        timestamp: '2026-09-19T00:00:00Z'
      }
      const detail: ManagerComponents['schemas']['MessageTaskDone'] = {
        ui_id: taskId,
        kind,
        result: 'Operation failed',
        status,
        timestamp: '2026-09-19T00:00:00Z',
        state: {
          installed_packs: {},
          running_queue: [],
          pending_queue: [],
          history: { [taskId]: historyItem }
        }
      }
      api.dispatchCustomEvent('cm-task-completed', detail)
      await nextTick()
      api.dispatchCustomEvent('cm-task-completed', detail)
      expect(legacyToastMessages()).toEqual([
        expect.objectContaining({
          severity: 'error',
          detail: 'Operation failed'
        })
      ])
      expect(store.failedTasksLogs.map((log) => log.taskId)).toEqual([
        baseTaskId
      ])
      expect(store.succeededTasksLogs).toEqual([])
    }
  )

  it.for<{
    name: string
    eventStatus: TaskExecutionStatus | undefined
    historyStatus: TaskExecutionStatus['status_str']
    clientId: string
    toastCount: number
  }>([
    {
      name: 'history failure without event status',
      eventStatus: undefined,
      historyStatus: 'error',
      clientId: 'test-client',
      toastCount: 1
    },
    {
      name: 'history success without event status',
      eventStatus: undefined,
      historyStatus: 'success',
      clientId: 'test-client',
      toastCount: 0
    },
    {
      name: 'another client history failure',
      eventStatus: undefined,
      historyStatus: 'error',
      clientId: 'other-client',
      toastCount: 0
    },
    {
      name: 'explicit event success over history failure',
      eventStatus: { status_str: 'success', completed: true, messages: [] },
      historyStatus: 'error',
      clientId: 'test-client',
      toastCount: 0
    }
  ])(
    'uses the completion status contract for $name',
    async ({ eventStatus, historyStatus, clientId, toastCount }) => {
      useComfyManagerStore()
      const historyItem: ManagerComponents['schemas']['TaskHistoryItem'] = {
        ui_id: 'status-fallback',
        client_id: clientId,
        kind: 'update',
        result: 'Update result',
        status: {
          status_str: historyStatus,
          completed: true,
          messages: []
        },
        timestamp: '2026-09-19T00:00:00Z'
      }
      const detail: ManagerComponents['schemas']['MessageTaskDone'] = {
        ui_id: historyItem.ui_id,
        kind: historyItem.kind,
        result: historyItem.result,
        status: eventStatus,
        timestamp: historyItem.timestamp,
        state: {
          installed_packs: {},
          running_queue: [],
          pending_queue: [],
          history: { [historyItem.ui_id]: historyItem }
        }
      }
      api.dispatchCustomEvent('cm-task-completed', detail)
      await nextTick()
      api.dispatchCustomEvent('cm-task-completed', detail)
      expect(legacyToastMessages()).toHaveLength(toastCount)
    }
  )

  it.for(scenarios)(
    'accepted $method stays pending after another rejection',
    async ({ run }) => {
      const store = useComfyManagerStore()
      await run(store)
      const taskId = store.taskLogs[0].taskId
      expect(store.isProcessingTasks).toBe(true)
      expect(store.isTaskInProgress(taskId)).toBe(true)
      vi.mocked(mockManagerService.installPack).mockImplementationOnce(
        async () => {
          mockManagerService.error.value = 'Request rejected'
          return null
        }
      )
      await store.installPack.call({
        id: 'rejected-pack',
        version: '1.0.0',
        selected_version: '1.0.0',
        mode: 'cache',
        channel: 'default'
      })
      expect(store.isProcessingTasks).toBe(true)
      expect(store.isTaskInProgress(taskId)).toBe(true)
    }
  )

  it('keeps an empty Update All batch completed when another request starts', async () => {
    vi.mocked(mockManagerService.getQueueStatus).mockResolvedValueOnce({
      total_count: 0,
      done_count: 0,
      in_progress_count: 0,
      pending_count: 0,
      is_processing: false
    })
    const store = useComfyManagerStore()
    await store.updateAllPacks.call({})
    const taskId = store.taskLogs[0].taskId
    expect(store.isProcessingTasks).toBe(false)
    expect(store.isTaskInProgress(taskId)).toBe(false)
    expect(store.succeededTasksLogs.map((log) => log.taskId)).toEqual([taskId])
    expect(store.failedTasksIds).toEqual([])
    expect(legacyToastMessages()).toEqual([])

    await store.enablePack({ id: 'other-pack', version: '1.0.0' })
    expect(store.isProcessingTasks).toBe(true)
    expect(store.isTaskInProgress(taskId)).toBe(false)
    expect(store.isTaskInProgress(store.taskLogs[1].taskId)).toBe(true)
  })

  it('waits for a queue snapshot before completing an unobserved batch during other work', async () => {
    const store = useComfyManagerStore()
    await store.updateAllPacks.call({})
    const taskId = store.taskLogs[0].taskId
    expect(store.isTaskInProgress(taskId)).toBe(true)

    const otherTask: ManagerComponents['schemas']['QueueTaskItem'] = {
      ui_id: 'other-request',
      client_id: 'test-client',
      kind: 'enable',
      params: { cnr_id: 'other-pack' }
    }
    api.dispatchCustomEvent('cm-task-started', {
      ui_id: otherTask.ui_id,
      kind: otherTask.kind,
      timestamp: '2026-09-19T04:00:00Z',
      state: {
        running_queue: [otherTask],
        pending_queue: [],
        history: {},
        installed_packs: {}
      }
    })
    await nextTick()

    expect(store.isTaskInProgress(taskId)).toBe(false)
    expect(store.isTaskInProgress(otherTask.ui_id)).toBe(true)
    expect(store.isProcessingTasks).toBe(true)
  })

  it('uses a newer queue snapshot when confirmation arrives after unrelated work starts', async () => {
    const response = deferred<
      ManagerComponents['schemas']['QueueStatus'] | null
    >()
    const requested = deferred<void>()
    vi.mocked(mockManagerService.getQueueStatus).mockImplementationOnce(() => {
      requested.resolve()
      return response.promise
    })
    const store = useComfyManagerStore()
    const updating = store.updateAllPacks.call({})
    await requested.promise
    const taskId = store.taskLogs[0].taskId
    const otherTask: ManagerComponents['schemas']['QueueTaskItem'] = {
      ui_id: 'other-request',
      client_id: 'test-client',
      kind: 'enable',
      params: { cnr_id: 'other-pack' }
    }
    api.dispatchCustomEvent('cm-task-started', {
      ui_id: otherTask.ui_id,
      kind: otherTask.kind,
      timestamp: '2026-09-19T04:00:00Z',
      state: {
        running_queue: [otherTask],
        pending_queue: [],
        history: {},
        installed_packs: {}
      }
    })
    expect(store.isTaskInProgress(taskId)).toBe(true)
    response.resolve({
      total_count: 1,
      done_count: 0,
      in_progress_count: 1,
      pending_count: 0,
      is_processing: true
    })
    await updating

    expect(store.isTaskInProgress(taskId)).toBe(false)
    expect(store.isTaskInProgress(otherTask.ui_id)).toBe(true)
    expect(store.isProcessingTasks).toBe(true)
  })

  it('keeps a request in progress when a different request is rejected before acceptance', async () => {
    const response = deferred<string | null>()
    vi.mocked(mockManagerService.enablePack).mockReturnValueOnce(
      response.promise
    )
    const store = useComfyManagerStore()
    const enabling = store.enablePack({ id: 'pending-pack', version: '1.0.0' })
    vi.mocked(mockManagerService.disablePack).mockResolvedValueOnce(null)
    await store.disablePack({ id: 'other-pack', version: '1.0.0' })
    expect(store.isProcessingTasks).toBe(true)
    response.resolve('')
    await enabling
    expect(store.isProcessingTasks).toBe(true)
  })

  it('retries queue status confirmation without resubmitting an empty batch', async () => {
    vi.mocked(mockManagerService.getQueueStatus).mockImplementationOnce(
      async () => {
        mockManagerService.error.value = 'Unable to confirm queue status'
        return null
      }
    )
    const store = useComfyManagerStore()
    await store.updateAllPacks.call({})
    expect(store.isProcessingTasks).toBe(true)
    expect(store.queueError).toBe('Unable to confirm queue status')
    vi.mocked(mockManagerService.getQueueStatus).mockResolvedValue({
      total_count: 0,
      done_count: 0,
      in_progress_count: 0,
      pending_count: 0,
      is_processing: false
    })
    await store.startQueue()
    expect(store.isProcessingTasks).toBe(false)
    expect(store.queueError).toBeNull()
    expect(mockManagerService.updateAllPacks).toHaveBeenCalledOnce()
  })

  it.for([
    {
      name: 'older failure after a newer success',
      olderResult: null,
      olderError: 'Older startup failed',
      newerResult: '',
      newerError: null,
      expectedToasts: []
    },
    {
      name: 'older failure after a newer failure',
      olderResult: null,
      olderError: 'Older startup failed',
      newerResult: null,
      newerError: 'Latest startup failed',
      expectedToasts: [
        expect.objectContaining({ detail: 'Latest startup failed' })
      ]
    },
    {
      name: 'older success after a newer failure',
      olderResult: '',
      olderError: null,
      newerResult: null,
      newerError: 'Latest startup failed',
      expectedToasts: [
        expect.objectContaining({ detail: 'Latest startup failed' })
      ]
    }
  ])(
    'preserves the latest queue startup result: $name',
    async ({
      olderResult,
      olderError,
      newerResult,
      newerError,
      expectedToasts
    }) => {
      const response = deferred<string | null>()
      const requested = deferred<void>()
      vi.mocked(mockManagerService.startQueue)
        .mockImplementationOnce(() => {
          requested.resolve()
          return response.promise
        })
        .mockImplementationOnce(async () => {
          mockManagerService.error.value = newerError
          return newerResult
        })
      const store = useComfyManagerStore()
      const enabling = store.enablePack({ id: 'first-pack', version: '1.0.0' })
      await requested.promise
      await store.disablePack({ id: 'second-pack', version: '1.0.0' })
      vi.mocked(mockManagerService.getQueueStatus).mockResolvedValue({
        total_count: 0,
        done_count: 0,
        in_progress_count: 0,
        pending_count: 0,
        is_processing: false
      })

      mockManagerService.error.value = olderError
      response.resolve(olderResult)
      await enabling

      expect(store.isProcessingTasks).toBe(true)
      expect(store.queueError).toBe(newerError)
      expect(legacyToastMessages()).toEqual(expectedToasts)
    }
  )

  it('ignores a startup failure from before reset while a new submission is pending', async () => {
    const response = deferred<string | null>()
    const requested = deferred<void>()
    vi.mocked(mockManagerService.startQueue).mockImplementationOnce(() => {
      requested.resolve()
      return response.promise
    })
    const store = useComfyManagerStore()
    const enabling = store.enablePack({ id: 'old-pack', version: '1.0.0' })
    await requested.promise
    store.resetTaskState()
    const submission = deferred<string | null>()
    vi.mocked(mockManagerService.disablePack).mockReturnValueOnce(
      submission.promise
    )
    const disabling = store.disablePack({ id: 'new-pack', version: '1.0.0' })
    onTestFinished(async () => {
      submission.resolve('')
      await disabling
    })

    mockManagerService.error.value = 'Old startup failed'
    response.resolve(null)
    await enabling

    expect(store.isProcessingTasks).toBe(true)
    expect(store.queueError).toBeNull()
    expect(legacyToastMessages()).toEqual([])
  })

  it('keeps a newer completion event when an earlier queue status request finishes', async () => {
    const response = deferred<
      ManagerComponents['schemas']['QueueStatus'] | null
    >()
    const requested = deferred<void>()
    vi.mocked(mockManagerService.getQueueStatus).mockImplementationOnce(() => {
      requested.resolve()
      return response.promise
    })
    const store = useComfyManagerStore()
    const updating = store.updateAllPacks.call({})
    await requested.promise
    const baseTaskId = vi.mocked(mockManagerService.updateAllPacks).mock
      .calls[0][1]
    assert.isDefined(baseTaskId)
    const taskId = `${baseTaskId}_pack`
    const historyItem: ManagerComponents['schemas']['TaskHistoryItem'] = {
      ui_id: taskId,
      client_id: 'test-client',
      kind: 'update',
      result: 'success',
      status: { status_str: 'success', completed: true, messages: [] },
      timestamp: '2026-09-19T00:00:00Z'
    }
    api.dispatchCustomEvent('cm-task-completed', {
      ui_id: taskId,
      kind: 'update',
      result: 'success',
      status: historyItem.status,
      timestamp: historyItem.timestamp,
      state: {
        running_queue: [],
        pending_queue: [],
        installed_packs: {},
        history: { [taskId]: historyItem }
      }
    })
    response.resolve({
      total_count: 1,
      done_count: 0,
      in_progress_count: 1,
      pending_count: 0,
      is_processing: true
    })
    await updating
    expect(store.isProcessingTasks).toBe(false)
    expect(store.succeededTasksIds).toEqual([taskId])
  })

  it('ignores an older status response after another request confirms queued work', async () => {
    const response = deferred<
      ManagerComponents['schemas']['QueueStatus'] | null
    >()
    const requested = deferred<void>()
    vi.mocked(mockManagerService.getQueueStatus).mockImplementationOnce(() => {
      requested.resolve()
      return response.promise
    })
    const store = useComfyManagerStore()
    const emptyBatch = store.updateAllPacks.call({})
    await requested.promise
    await store.enablePack({ id: 'pending-pack', version: '1.0.0' })
    response.resolve({
      total_count: 0,
      done_count: 0,
      in_progress_count: 0,
      pending_count: 0,
      is_processing: false
    })
    await emptyBatch
    expect(store.isProcessingTasks).toBe(true)
  })

  const testCases: EnabledDisabledTestCase[] = [
    {
      desc: 'Two enabled versions',
      installed: {
        'name@1_0_2': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two disabled versions',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled version and pinned disabled version',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled version and pinned enabled version',
      installed: {
        'name@1_0_2': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Pinned enabled version, Pinned disabled version',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        'name@1_0_3': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.3',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two enabled non-CNR versions',
      packName: 'author/name',
      installed: {
        'author/name@1_0_2': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.2'
        },
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two disabled non-CNR versions',
      packName: 'author/name',
      installed: {
        'author/name@1_0_2': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.2'
        },
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Non-CNR disabled version, CNR enabled version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: true,
          cnr_id: 'author/name',
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled non-CNR version, CNR disabled version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined, // non-CNR pack
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: false,
          cnr_id: 'author/name', // CNR pack
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled non-CNR version, two versions',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: true,
          cnr_id: 'author/name',
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Enabled CNR version',
      packName: 'name',
      installed: {
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled CNR version',
      packName: 'name',
      installed: {
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled non-CNR version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled non-CNR version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Pack not installed',
      installed: {
        'a different pack': {
          enabled: true,
          cnr_id: 'a different pack',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    }
  ]

  describe('isPackEnabled', () => {
    it.for(testCases)(
      '$expectState when $desc',
      async ({ installed, expectState, packName }) => {
        packName ??= 'name'

        const store = useComfyManagerStore()
        await triggerPacksChange(installed, store)

        const enabled = expectState === 'enabled'
        expect(store.isPackEnabled(packName)).toBe(enabled)
      }
    )
  })

  describe('isPackInstalling', () => {
    it('returns no installed version for a pack that is not installed', () => {
      const store = useComfyManagerStore()
      expect(store.getInstalledPackVersion('not-installed')).toBeUndefined()
    })

    it('should return false for packs not being installed', () => {
      const store = useComfyManagerStore()
      expect(store.isPackInstalling('test-pack')).toBe(false)
      expect(store.isPackInstalling(undefined)).toBe(false)
      expect(store.isPackInstalling('')).toBe(false)
    })

    it('should track pack as installing when installPack is called', async () => {
      const store = useComfyManagerStore()

      // Call installPack
      await store.installPack.call({
        id: 'test-pack',
        repository: 'https://github.com/test/test-pack',
        channel: 'dev',
        mode: 'cache',
        selected_version: 'latest',
        version: 'latest'
      })

      // Check that the pack is marked as installing
      expect(store.isPackInstalling('test-pack')).toBe(true)
    })

    it('should track multiple packs installing independently', async () => {
      const store = useComfyManagerStore()

      // Install pack 1
      await store.installPack.call({
        id: 'pack-1',
        repository: 'https://github.com/test/pack-1',
        channel: 'dev',
        mode: 'cache',
        selected_version: 'latest',
        version: 'latest'
      })

      // Install pack 2
      await store.installPack.call({
        id: 'pack-2',
        repository: 'https://github.com/test/pack-2',
        channel: 'dev',
        mode: 'cache',
        selected_version: 'latest',
        version: 'latest'
      })

      // Both should be installing
      expect(store.isPackInstalling('pack-1')).toBe(true)
      expect(store.isPackInstalling('pack-2')).toBe(true)
      expect(store.isPackInstalling('pack-3')).toBe(false)
    })
  })

  describe('refreshInstalledList with pack ID normalization', () => {
    it('normalizes pack IDs by removing version suffixes', async () => {
      const mockPacks = {
        'ComfyUI-GGUF@1_1_4': {
          enabled: false,
          cnr_id: 'ComfyUI-GGUF',
          ver: '1.1.4',
          aux_id: undefined
        },
        'ComfyUI-Manager': {
          enabled: true,
          cnr_id: 'ComfyUI-Manager',
          ver: '2.0.0',
          aux_id: undefined
        }
      }

      vi.mocked(mockManagerService.listInstalledPacks).mockResolvedValue(
        mockPacks
      )

      const store = useComfyManagerStore()
      await store.refreshInstalledList()

      // Both packs should be accessible by their base name
      expect(store.installedPacks['ComfyUI-GGUF']).toEqual({
        enabled: false,
        cnr_id: 'ComfyUI-GGUF',
        ver: '1.1.4',
        aux_id: undefined
      })
      expect(store.installedPacks['ComfyUI-Manager']).toEqual({
        enabled: true,
        cnr_id: 'ComfyUI-Manager',
        ver: '2.0.0',
        aux_id: undefined
      })

      // Version suffixed keys should not exist
      expect(store.installedPacks['ComfyUI-GGUF@1_1_4']).toBeUndefined()
    })

    it('handles duplicate keys after normalization', async () => {
      const mockPacks = {
        'test-pack': {
          enabled: true,
          cnr_id: 'test-pack',
          ver: '1.0.0',
          aux_id: undefined
        },
        'test-pack@1_1_0': {
          enabled: false,
          cnr_id: 'test-pack',
          ver: '1.1.0',
          aux_id: undefined
        }
      }

      vi.mocked(mockManagerService.listInstalledPacks).mockResolvedValue(
        mockPacks
      )

      const store = useComfyManagerStore()
      await store.refreshInstalledList()

      // The normalized key should exist (last one wins with mapKeys)
      expect(store.installedPacks['test-pack']).toBeDefined()
      expect(store.installedPacks['test-pack'].ver).toBe('1.1.0')
    })

    it('preserves version information for disabled packs', async () => {
      const mockPacks = {
        'disabled-pack@2_0_0': {
          enabled: false,
          cnr_id: 'disabled-pack',
          ver: '2.0.0',
          aux_id: undefined
        }
      }

      vi.mocked(mockManagerService.listInstalledPacks).mockResolvedValue(
        mockPacks
      )

      const store = useComfyManagerStore()
      await store.refreshInstalledList()

      // Pack should be accessible by base name with version preserved
      expect(store.getInstalledPackVersion('disabled-pack')).toBe('2.0.0')
      expect(store.isPackInstalled('disabled-pack')).toBe(true)
    })
  })
})
