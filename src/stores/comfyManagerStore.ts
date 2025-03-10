import { useTimeoutPoll } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { t } from '@/i18n'
import {
  type OperationResult,
  useComfyManagerService
} from '@/services/comfyManagerService'
import {
  InstallPackParams,
  InstalledPacksResponse,
  ManagerPackInfo,
  ManagerQueueStatus
} from '@/types/comfyManagerTypes'

const QUEUE_POLL_INTERVAL_MS = 1000

type ClientQueueItem = {
  job: () => Promise<OperationResult | void>
  restartAfter?: boolean
}

/**
 * Store for managing node pack operations and install state
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()

  const installedPacks = shallowRef<InstalledPacksResponse>({})
  const installedPacksChanged = ref(false)
  const appNeedsRestart = ref(false)

  const clientQueueItems = ref<ClientQueueItem[]>([])
  const clientQueueLength = computed(() => clientQueueItems.value.length)
  const isClientQueueEmpty = computed(() => clientQueueLength.value === 0)

  const serverQueueStatus = ref<ManagerQueueStatus>({
    total_count: 0,
    done_count: 0,
    in_progress_count: 0,
    is_processing: false
  })
  const isServerIdle = computed(() => !serverQueueStatus.value.is_processing)

  const allJobsDone = computed(
    () => isServerIdle.value && isClientQueueEmpty.value
  )
  const nextJobReady = computed(
    () => isServerIdle.value && !isClientQueueEmpty.value
  )

  const statusMessage = computed(() => {
    if (nextJobReady.value) return t('manager.queueStatus.nextJob')
    if (allJobsDone.value && serverQueueStatus.value.done_count)
      return t('manager.queueStatus.allJobsDone')
    if (serverQueueStatus.value.in_progress_count > 0)
      return t('manager.queueStatus.waiting', {
        count: serverQueueStatus.value.in_progress_count,
        total: serverQueueStatus.value.total_count + clientQueueLength.value
      })
    return t('manager.queueStatus.error')
  })

  const getServerQueueStatus = async () => {
    const status = await managerService.getQueueStatus()
    if (status) serverQueueStatus.value = status
  }

  const startNextJob = async () => {
    const nextJob = clientQueueItems.value.shift()
    if (nextJob) {
      const { job, restartAfter = false } = nextJob
      await job()
      if (restartAfter) setNeedsRestart(true)
    }
  }

  const {
    isActive: isPollingActive,
    pause: pausePolling,
    resume: resumePolling
  } = useTimeoutPoll(getServerQueueStatus, QUEUE_POLL_INTERVAL_MS)

  const onServerIdleChange = async (serverIdle: boolean) => {
    const shouldPausePolling = isPollingActive.value && allJobsDone.value
    const shouldResumePolling = !isPollingActive.value && !serverIdle

    if (shouldPausePolling) pausePolling()
    else if (shouldResumePolling) resumePolling()
    else if (nextJobReady.value) await startNextJob()
  }

  // Handle polling and sequentially sending jobs to server
  watch(isServerIdle, onServerIdleChange)

  // Handle first job
  watch(isClientQueueEmpty, async (isEmpty) => {
    if (!isEmpty) {
      await startNextJob()
      if (!isPollingActive.value) resumePolling()
    }
  })

  // Handle refreshing installed packs info
  watch(
    installedPacksChanged,
    async (changed) => {
      if (changed) {
        const packs = await managerService.listInstalledPacks()
        if (packs) installedPacks.value = packs
      }
    },
    { immediate: true }
  )

  /**
   * Set the needs restart flag
   */
  const setNeedsRestart = (value: boolean) => {
    appNeedsRestart.value = value
  }

  /**
   * Install pack
   */
  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      clientQueueItems.value.push({
        job: () => managerService.installPack(params, signal),
        restartAfter: true
      })
    },
    { maxSize: 1 }
  )

  /**
   * Update pack
   */
  const updatePack = useCachedRequest<ManagerPackInfo, void>(
    async (params: ManagerPackInfo, signal?: AbortSignal) => {
      clientQueueItems.value.push({
        job: () => managerService.updatePack(params, signal),
        restartAfter: true
      })
    },
    { maxSize: 1 }
  )

  /**
   * Update all packs
   */
  const updateAllPacks = useCachedRequest<void, void>(
    async (_, signal?: AbortSignal) => {
      clientQueueItems.value.push({
        job: () => managerService.updateAllPacks(signal),
        restartAfter: true
      })
    },
    { maxSize: 1 }
  )

  /**
   * Uninstall pack
   */
  const uninstallPack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    clientQueueItems.value.push({
      job: () => managerService.uninstallPack(params, signal),
      restartAfter: true
    })
  }

  /**
   * Disable pack
   */
  const disablePack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    clientQueueItems.value.push({
      job: () => managerService.disablePack(params, signal),
      restartAfter: true
    })
  }

  /**
   * Check if pack is installed
   */
  const isPackInstalled = (packName: string): boolean =>
    !!installedPacks.value[packName]

  /**
   * Check if pack is enabled
   */
  const isPackEnabled = (packName: string): boolean =>
    !!installedPacks.value[packName]?.enabled

  return {
    // Installed packs state
    installedPacks,
    isPackInstalled,
    isPackEnabled,

    // Manager state
    appNeedsRestart,
    statusMessage,
    isIdle: allJobsDone,
    isLoading: managerService.isLoading,
    error: managerService.error,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updateAllPacks,
    disablePack
  }
})
