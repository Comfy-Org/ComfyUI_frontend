import { useEventListener, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { t } from '@/i18n'
import { useCachedRequest } from '@/composables/useCachedRequest'
import { useServerLogs } from '@/composables/useServerLogs'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useComfyRegistryService } from '@/services/comfyRegistryService'

import { normalizePackKeys } from '@/utils/packUtils'
import { useManagerQueue } from '@/workbench/extensions/manager/composables/useManagerQueue'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import type {
  NodePackId,
  RegistryPack,
  TaskLog
} from '@/workbench/extensions/manager/types/comfyManagerTypes'
import type { components } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import { versionStatusFilters } from '@/workbench/extensions/manager/utils/nodePackVersionUtil'

type InstallPackParams = components['schemas']['InstallPackParams']
type InstalledPacksResponse = components['schemas']['InstalledPacksResponse']
type ManagerPackInfo = components['schemas']['ManagerPackInfo']
type ManagerPackInstalled = components['schemas']['ManagerPackInstalled']
type ManagerTaskHistory = Record<
  string,
  components['schemas']['TaskHistoryItem']
>
type ManagerTaskQueue = components['schemas']['TaskStateMessage']
type UpdateAllPacksParams = components['schemas']['UpdateAllPacksParams']

function isTaskForRequest(taskId: string, requestId: string) {
  return taskId === requestId || taskId.startsWith(`${requestId}_`)
}

/**
 * Store for state of installed node packs
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()
  const toastStore = useToastStore()

  const installedPacks = ref<InstalledPacksResponse>({})
  const enabledPacksIds = ref<Set<NodePackId>>(new Set())
  const disabledPacksIds = ref<Set<NodePackId>>(new Set())
  const installedPacksIds = ref<Set<NodePackId>>(new Set())
  const installingPacksIds = ref<Set<NodePackId>>(new Set())
  const updatingPacksIds = ref<Set<NodePackId>>(new Set())
  const isStale = ref(true)
  const taskLogs = ref<TaskLog[]>([])
  const succeededTasksLogs = ref<TaskLog[]>([])
  const failedTasksLogs = ref<TaskLog[]>([])

  const serverTaskHistory = ref<ManagerTaskHistory>({})
  const requestFailures = ref<ManagerTaskHistory>({})
  const taskHistory = computed(() => ({
    ...requestFailures.value,
    ...serverTaskHistory.value
  }))
  const queueError = ref<string | null>(null)
  const succeededTasksIds = ref<string[]>([])
  const failedTasksIds = ref<string[]>([])
  const taskQueue = ref<ManagerTaskQueue>({
    history: {},
    running_queue: [],
    pending_queue: [],
    installed_packs: {}
  })

  // Track task ID to pack ID mapping for proper state cleanup
  const taskIdToPackId = ref(new Map<string, NodePackId>())

  const managerQueue = useManagerQueue(
    serverTaskHistory,
    taskQueue,
    installedPacks
  )
  const pendingRequests = ref(
    new Map<string, 'submitting' | 'queued' | 'confirmed'>()
  )
  let queueStartRequest = 0
  const isProcessingTasks = computed(
    () =>
      managerQueue.isProcessing.value ||
      pendingRequests.value.size > 0 ||
      updatingPacksIds.value.size > 0
  )

  useEventListener(
    app.api,
    ['cm-task-started', 'cm-task-completed'],
    (
      event: CustomEvent<
        | components['schemas']['MessageTaskStarted']
        | components['schemas']['MessageTaskDone']
      >
    ) => {
      const { ui_id: taskId, state } = event.detail
      const observedIds = [
        ...state.running_queue.map((task) => task.ui_id),
        ...state.pending_queue.map((task) => task.ui_id),
        ...Object.keys(state.history)
      ]
      for (const id of observedIds) {
        delete requestFailures.value[id]
      }
      for (const [requestId, requestState] of pendingRequests.value) {
        if (
          requestState === 'confirmed' ||
          observedIds.some((id) => isTaskForRequest(id, requestId))
        ) {
          pendingRequests.value.delete(requestId)
        }
      }
      if (event.type === 'cm-task-completed') {
        const packId = taskIdToPackId.value.get(taskId)
        if (packId) installingPacksIds.value.delete(packId)
        taskIdToPackId.value.delete(taskId)
      }
      if (
        managerQueue.currentQueueLength.value > 0 ||
        !isProcessingTasks.value
      ) {
        queueError.value = null
      }
    }
  )

  const setStale = () => {
    isStale.value = true
  }

  function isTaskFailed(requestId: string) {
    return failedTasksIds.value.some((id) => isTaskForRequest(id, requestId))
  }

  function isTaskInProgress(requestId: string) {
    return (
      pendingRequests.value.has(requestId) ||
      [...taskQueue.value.running_queue, ...taskQueue.value.pending_queue].some(
        (task) => isTaskForRequest(task.ui_id, requestId)
      )
    )
  }

  const partitionTaskLogs = () => {
    const successTaskLogs: TaskLog[] = []
    const failTaskLogs: TaskLog[] = []
    for (const log of taskLogs.value) {
      if (isTaskFailed(log.taskId)) {
        failTaskLogs.push(log)
      } else {
        successTaskLogs.push(log)
      }
    }
    succeededTasksLogs.value = successTaskLogs
    failedTasksLogs.value = failTaskLogs
  }

  const partitionTasks = () => {
    const successTasksIds = []
    const failTasksIds = []
    for (const task of Object.values(taskHistory.value)) {
      if (task.status?.status_str === 'success') {
        successTasksIds.push(task.ui_id)
      } else {
        failTasksIds.push(task.ui_id)
      }
    }
    succeededTasksIds.value = successTasksIds
    failedTasksIds.value = failTasksIds
  }

  whenever(
    taskHistory,
    () => {
      partitionTasks()
      partitionTaskLogs()
    },
    { deep: true }
  )

  const getPackId = (pack: ManagerPackInstalled) => pack.cnr_id || pack.aux_id

  const isInstalledPackId = (packName: NodePackId | undefined): boolean =>
    !!packName && installedPacksIds.value.has(packName)

  const isEnabledPackId = (packName: NodePackId | undefined): boolean =>
    !!packName &&
    isInstalledPackId(packName) &&
    enabledPacksIds.value.has(packName)

  const isInstallingPackId = (packName: NodePackId | undefined): boolean =>
    !!packName &&
    (installingPacksIds.value.has(packName) ||
      updatingPacksIds.value.has(packName))

  const packsToIdSet = (packs: ManagerPackInstalled[]) =>
    packs.reduce((acc, pack) => {
      const id = pack.cnr_id || pack.aux_id
      if (id) acc.add(id)
      return acc
    }, new Set<NodePackId>())

  /**
   * A pack is disabled if there is a disabled entry and no corresponding
   * enabled entry. If `packname@1.0.2` is disabled, but `packname@1.0.3` is
   * enabled, then `packname` is considered enabled.
   *
   * @example
   * installedPacks = {
   *   "packname@1_0_2": { enabled: false, cnr_id: "packname" },
   *   "packname": { enabled: true, cnr_id: "packname" }
   * }
   * isDisabled("packname") // false
   *
   * installedPacks = {
   *   "packname@1_0_2": { enabled: false, cnr_id: "packname" },
   * }
   * isDisabled("packname") // true
   */
  const updateDisabledIds = (packs: ManagerPackInstalled[]) => {
    // Use temporary variables to avoid triggering reactivity
    const enabledIds = new Set<NodePackId>()
    const disabledIds = new Set<NodePackId>()

    for (const pack of packs) {
      const id = getPackId(pack)
      if (!id) continue

      const { enabled } = pack

      if (enabled) enabledIds.add(id)
      else disabledIds.add(id)

      // If pack in both (has a disabled and enabled version), remove from disabled
      const inBothSets = enabledIds.has(id) && disabledIds.has(id)
      if (inBothSets) disabledIds.delete(id)
    }

    enabledPacksIds.value = enabledIds
    disabledPacksIds.value = disabledIds
  }

  const updateInstalledIds = (packs: ManagerPackInstalled[]) => {
    installedPacksIds.value = packsToIdSet(packs)
  }

  const onPacksChanged = () => {
    const packs = Object.values(installedPacks.value)
    updateDisabledIds(packs)
    updateInstalledIds(packs)
  }

  watch(installedPacks, onPacksChanged, { deep: true })

  const refreshInstalledList = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) {
      // Normalize pack keys to ensure consistent access
      installedPacks.value = normalizePackKeys(packs)
    }
    isStale.value = false
  }

  whenever(isStale, refreshInstalledList, { immediate: true })

  async function confirmQueuedRequests() {
    const queuedRequests = [...pendingRequests.value]
      .filter(([, state]) => state !== 'submitting')
      .map(([id]) => id)
    if (!queuedRequests.length) return true

    const runningQueue = taskQueue.value.running_queue
    const requestId = queueStartRequest
    const status = await managerService.getQueueStatus(
      api.clientId ?? api.initialClientId ?? 'unknown'
    )
    if (requestId !== queueStartRequest) return true
    if (status === null) return false

    const hasNewQueueState = taskQueue.value.running_queue !== runningQueue
    for (const id of queuedRequests) {
      if (status.total_count > 0 && !hasNewQueueState) {
        pendingRequests.value.set(id, 'confirmed')
      } else {
        pendingRequests.value.delete(id)
      }
    }
    return true
  }

  async function startQueue() {
    const requestId = ++queueStartRequest
    queueError.value = null
    const result = await managerService.startQueue()
    if (requestId !== queueStartRequest) return
    if (result !== null && (await confirmQueuedRequests())) return

    if (requestId === queueStartRequest && isProcessingTasks.value) {
      queueError.value = managerService.error.value ?? t('g.unknownError')
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: queueError.value
      })
    }
  }

  const enqueueTaskWithLogs = async (
    task: (taskId: string) => Promise<string | null>,
    taskName: string
  ) => {
    const taskId = uuidv4()
    const { logs } = useServerLogs({
      ui_id: taskId,
      immediate: true
    })

    pendingRequests.value.set(taskId, 'submitting')
    taskLogs.value.push({ taskName, taskId, logs: logs.value })
    partitionTaskLogs()

    const result = await task(taskId)
    if (result === null) {
      const packId = taskIdToPackId.value.get(taskId)
      if (packId) installingPacksIds.value.delete(packId)
      taskIdToPackId.value.delete(taskId)
      pendingRequests.value.delete(taskId)
      const message = managerService.error.value ?? t('g.unknownError')
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: message
      })

      requestFailures.value[taskId] = {
        ui_id: taskId,
        client_id: api.clientId || 'unknown',
        kind: 'error',
        result: 'failed',
        status: {
          status_str: 'error',
          completed: false,
          messages: [message]
        },
        timestamp: new Date().toISOString()
      }
      return
    }
    if (pendingRequests.value.has(taskId)) {
      pendingRequests.value.set(taskId, 'queued')
    }
    await startQueue()
  }

  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      if (!params.id || installingPacksIds.value.has(params.id)) return

      let actionDescription = t('g.installing')
      if (installedPacksIds.value.has(params.id)) {
        const installedPack = installedPacks.value[params.id]

        if (installedPack.ver !== params.selected_version) {
          actionDescription = t('manager.changingVersion', {
            from: installedPack.ver,
            to: params.selected_version
          })
        } else {
          actionDescription = t('g.enabling')
        }
      }

      installingPacksIds.value.add(params.id)
      const task = (taskId: string) => {
        taskIdToPackId.value.set(taskId, params.id)
        return managerService.installPack(params, taskId, signal)
      }
      await enqueueTaskWithLogs(task, `${actionDescription} ${params.id}`)
    },
    { maxSize: 1 }
  )

  async function switchPack(
    pack: RegistryPack & { id: NodePackId },
    policy: keyof typeof versionStatusFilters
  ) {
    const registry = useComfyRegistryService()
    const summary = pack.name ?? pack.id
    const versions = await registry.getPackVersions(pack.id, {
      statuses: versionStatusFilters[policy]
    })
    if (!isEnabledPackId(pack.id)) return
    if (versions === null) {
      toastStore.add({
        severity: 'error',
        summary,
        detail: registry.error.value ?? t('manager.errorConnecting')
      })
      return
    }
    const version = versions[0]?.version
    if (!version) {
      toastStore.add({
        severity: 'warn',
        summary,
        detail: t('manager.noUpdateVersion')
      })
      return
    }
    if (version === getInstalledPackVersion(pack.id)) {
      toastStore.add({
        severity: 'info',
        summary,
        detail: t('manager.updateVersionInstalled', { version })
      })
      return
    }
    await installPack.call({
      id: pack.id,
      version,
      selected_version: version,
      repository: pack.repository ?? '',
      channel: 'default',
      mode: 'cache'
    })
  }

  async function updatePacks(
    packs: RegistryPack[],
    policy: keyof typeof versionStatusFilters = 'active'
  ) {
    const packsToUpdate = packs.filter(
      (pack): pack is RegistryPack & { id: NodePackId } =>
        isEnabledPackId(pack.id) && !isInstallingPackId(pack.id)
    )
    if (!packsToUpdate.length) return
    for (const pack of packsToUpdate) {
      updatingPacksIds.value.add(pack.id)
    }
    try {
      for (const pack of packsToUpdate) {
        await switchPack(pack, policy)
      }
    } catch (error) {
      reportError(error, { errorType: 'failure_updating_node_packs' })
      toastStore.add({
        severity: 'error',
        summary: t('manager.update'),
        detail: t('manager.updateFailed')
      })
    } finally {
      for (const pack of packsToUpdate) {
        updatingPacksIds.value.delete(pack.id)
      }
      installPack.clear()
    }
  }

  const uninstallPack = async (
    params: ManagerPackInfo,
    signal?: AbortSignal
  ) => {
    installPack.clear()
    installPack.cancel()

    installingPacksIds.value.add(params.id)
    const uninstallParams: components['schemas']['UninstallPackParams'] = {
      node_name: params.id,
      is_unknown: false
    }
    const task = (taskId: string) => {
      taskIdToPackId.value.set(taskId, params.id)
      return managerService.uninstallPack(uninstallParams, taskId, signal)
    }
    await enqueueTaskWithLogs(
      task,
      t('manager.uninstalling', { id: params.id })
    )
  }

  const updatePack = useCachedRequest<ManagerPackInfo, void>(
    async (params: ManagerPackInfo, signal?: AbortSignal) => {
      updateAllPacks.cancel()
      const updateParams: components['schemas']['UpdatePackParams'] = {
        node_name: params.id,
        node_ver: params.version
      }
      const task = (taskId: string) =>
        managerService.updatePack(updateParams, taskId, signal)
      await enqueueTaskWithLogs(task, t('g.updating', { id: params.id }))
    },
    { maxSize: 1 }
  )

  const updateAllPacks = useCachedRequest<UpdateAllPacksParams, void>(
    async (params: UpdateAllPacksParams, signal?: AbortSignal) => {
      const task = (taskId: string) =>
        managerService.updateAllPacks(params, taskId, signal)
      await enqueueTaskWithLogs(task, t('manager.updatingAllPacks'))
    },
    { maxSize: 1 }
  )

  const disablePack = async (params: ManagerPackInfo, signal?: AbortSignal) => {
    const disableParams: components['schemas']['DisablePackParams'] = {
      node_name: params.id,
      is_unknown: false
    }
    const task = (taskId: string) =>
      managerService.disablePack(disableParams, taskId, signal)
    await enqueueTaskWithLogs(task, t('g.disabling', { id: params.id }))
  }

  const enablePack = async (params: ManagerPackInfo, signal?: AbortSignal) => {
    const enableParams: components['schemas']['EnablePackParams'] = {
      cnr_id: params.id
    }
    const task = (taskId: string) =>
      managerService.enablePack(enableParams, taskId, signal)
    await enqueueTaskWithLogs(task, t('g.enabling', { id: params.id }))
  }

  const getInstalledPackVersion = (packId: NodePackId) => {
    if (!Object.hasOwn(installedPacks.value, packId)) return
    const pack = installedPacks.value[packId]
    return pack.ver
  }

  const clearLogs = () => {
    taskLogs.value = []
  }

  const resetTaskState = () => {
    queueError.value = null
    // Clear all task-related reactive state for fresh start after restart
    taskLogs.value = []
    serverTaskHistory.value = {}
    requestFailures.value = {}
    succeededTasksIds.value = []
    failedTasksIds.value = []
    succeededTasksLogs.value = []
    failedTasksLogs.value = []
    installingPacksIds.value.clear()
    updatingPacksIds.value.clear()
    taskIdToPackId.value.clear()
    pendingRequests.value.clear()
    queueStartRequest++
    managerQueue.isProcessing.value = false

    // Reset task queue to initial state
    taskQueue.value = {
      history: {},
      running_queue: [],
      pending_queue: [],
      installed_packs: {}
    }
  }

  return {
    // Manager state
    isLoading: managerService.isLoading,
    error: managerService.error,
    taskLogs,
    clearLogs,
    resetTaskState,
    setStale,

    // Installed packs state
    installedPacks,
    installedPacksIds,
    isPackInstalled: isInstalledPackId,
    isPackEnabled: isEnabledPackId,
    isPackInstalling: isInstallingPackId,
    getInstalledPackVersion,
    refreshInstalledList,

    // Task queue state and actions
    taskHistory,
    taskQueue,
    queueError,
    startQueue,
    isProcessingTasks,
    succeededTasksIds,
    failedTasksIds,
    isTaskFailed,
    isTaskInProgress,
    succeededTasksLogs,
    failedTasksLogs,
    managerQueue,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updatePacks,
    updateAllPacks,
    disablePack,
    enablePack
  }
})
