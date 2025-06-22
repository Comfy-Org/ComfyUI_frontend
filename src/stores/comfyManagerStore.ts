import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useManagerQueue } from '@/composables/useManagerQueue'
import { useServerLogs } from '@/composables/useServerLogs'
import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useDialogService } from '@/services/dialogService'
import { TaskLog } from '@/types/comfyManagerTypes'
import { components } from '@/types/generatedManagerTypes'

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

/**
 * Store for state of installed node packs
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const { t } = useI18n()
  const managerService = useComfyManagerService()
  const { showManagerProgressDialog } = useDialogService()

  const installedPacks = ref<InstalledPacksResponse>({})
  const enabledPacksIds = ref<Set<string>>(new Set())
  const disabledPacksIds = ref<Set<string>>(new Set())
  const installedPacksIds = ref<Set<string>>(new Set())
  const isStale = ref(true)
  const taskLogs = ref<TaskLog[]>([])
  const succeededTasksLogs = ref<TaskLog[]>([])
  const failedTasksLogs = ref<TaskLog[]>([])

  const taskHistory = ref<ManagerTaskHistory>({})
  const succeededTasksIds = ref<string[]>([])
  const failedTasksIds = ref<string[]>([])
  const taskQueue = ref<ManagerTaskQueue>({
    history: {},
    running_queue: [],
    pending_queue: [],
    installed_packs: {}
  })

  const managerQueue = useManagerQueue(taskHistory, taskQueue, installedPacks)

  const setStale = () => {
    isStale.value = true
  }

  const partitionTaskLogs = () => {
    const successTaskLogs: TaskLog[] = []
    const failTaskLogs: TaskLog[] = []
    for (const log of taskLogs.value) {
      if (failedTasksIds.value.includes(log.taskId)) {
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

  const isInstalledPackId = (packName: string | undefined): boolean =>
    !!packName && installedPacksIds.value.has(packName)

  const isEnabledPackId = (packName: string | undefined): boolean =>
    !!packName &&
    isInstalledPackId(packName) &&
    enabledPacksIds.value.has(packName)

  const packsToIdSet = (packs: ManagerPackInstalled[]) =>
    packs.reduce((acc, pack) => {
      const id = pack.cnr_id || pack.aux_id
      if (id) acc.add(id)
      return acc
    }, new Set<string>())

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
    const enabledIds = new Set<string>()
    const disabledIds = new Set<string>()

    for (const pack of packs) {
      const id = getPackId(pack)
      if (!id) continue

      const { enabled } = pack

      if (enabled === true) enabledIds.add(id)
      else if (enabled === false) disabledIds.add(id)

      // If pack in both (has a disabled and enabled version), remove from disabled
      const inBothSets = enabledIds.has(id) && disabledIds.has(id)
      if (inBothSets) disabledIds.delete(id)
    }

    enabledPacksIds.value = enabledIds
    disabledPacksIds.value = disabledIds
  }

  const updateInstalledIds = (packs: ManagerPackInstalled[]) => {
    const newIds = packsToIdSet(packs)
    installedPacksIds.value = newIds
  }

  const onPacksChanged = () => {
    const packs = Object.values(installedPacks.value)

    updateDisabledIds(packs)
    updateInstalledIds(packs)
  }

  watch(installedPacks, onPacksChanged, { deep: true })

  const refreshInstalledList = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    isStale.value = false
  }

  whenever(isStale, refreshInstalledList, { immediate: true })

  const enqueueTaskWithLogs = async (
    task: (taskId: string) => Promise<null>,
    taskName: string
  ) => {
    const taskId = uuidv4()
    const { startListening, logs } = useServerLogs({
      ui_id: taskId
    })

    try {
      // Show progress dialog immediately when task is queued
      showManagerProgressDialog()
      managerQueue.isProcessing.value = true

      // Prepare logging hook
      taskLogs.value.push({ taskName, taskId, logs: logs.value })
      await startListening()

      // Queue the task to the server
      await task(taskId)
    } catch (error) {
      // Reset processing state on error
      managerQueue.isProcessing.value = false

      // The server has authority over task history in general, but in rare
      // case of client-side error, we add that to failed tasks from the client side
      taskHistory.value[taskId] = {
        ui_id: taskId,
        client_id: api.clientId || 'unknown',
        kind: 'error',
        result: 'failed',
        status: {
          status_str: 'error',
          completed: false,
          messages: [error instanceof Error ? error.message : String(error)]
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      if (!params.id) return

      let actionDescription = t('g.installing')
      if (installedPacksIds.value.has(params.id)) {
        const installedPack = installedPacks.value[params.id]

        if (installedPack && installedPack.ver !== params.selected_version) {
          actionDescription = t('manager.changingVersion', {
            from: installedPack.ver,
            to: params.selected_version
          })
        } else {
          actionDescription = t('g.enabling')
        }
      }

      const task = (taskId: string) =>
        managerService.installPack(params, taskId, signal)
      await enqueueTaskWithLogs(task, `${actionDescription} ${params.id}`)
    },
    { maxSize: 1 }
  )

  const uninstallPack = async (
    params: ManagerPackInfo,
    signal?: AbortSignal
  ) => {
    installPack.clear()
    installPack.cancel()
    const uninstallParams: components['schemas']['UninstallPackParams'] = {
      node_name: params.id,
      is_unknown: false
    }
    const task = (taskId: string) =>
      managerService.uninstallPack(uninstallParams, taskId, signal)
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

  const getInstalledPackVersion = (packId: string) => {
    const pack = installedPacks.value[packId]
    return pack?.ver
  }

  const clearLogs = () => {
    taskLogs.value = []
  }

  return {
    // Manager state
    isLoading: managerService.isLoading,
    error: managerService.error,
    taskLogs,
    clearLogs,
    setStale,

    // Installed packs state
    installedPacks,
    installedPacksIds,
    isPackInstalled: isInstalledPackId,
    isPackEnabled: isEnabledPackId,
    getInstalledPackVersion,

    // Task queue state and actions
    taskHistory,
    isProcessingTasks: managerQueue.isProcessing,
    succeededTasksIds,
    failedTasksIds,
    succeededTasksLogs,
    failedTasksLogs,
    managerQueue,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updateAllPacks,
    disablePack,
    enablePack: installPack // Enable is done via install endpoint with a disabled pack
  }
})

/**
 * Store for state of the manager progress dialog content.
 * The dialog itself is managed by the dialog store. This store is used to
 * manage the visibility of the dialog's content, header, footer.
 */
export const useManagerProgressDialogStore = defineStore(
  'managerProgressDialog',
  () => {
    const isExpanded = ref(false)
    const activeTabIndex = ref(0)

    const setActiveTabIndex = (index: number) => {
      activeTabIndex.value = index
    }

    const getActiveTabIndex = () => {
      return activeTabIndex.value
    }

    const toggle = () => {
      isExpanded.value = !isExpanded.value
    }

    const collapse = () => {
      isExpanded.value = false
    }

    const expand = () => {
      isExpanded.value = true
    }
    return {
      isExpanded,
      toggle,
      collapse,
      expand,
      setActiveTabIndex,
      getActiveTabIndex
    }
  }
)
