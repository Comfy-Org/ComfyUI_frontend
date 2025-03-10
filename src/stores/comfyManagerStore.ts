import { useTimeoutPoll, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { t } from '@/i18n'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  InstallPackParams,
  InstalledPacksResponse,
  ManagerPackInfo,
  ManagerQueueStatus
} from '@/types/comfyManagerTypes'

const QUEUE_POLL_INTERVAL_MS = 1024

type ClientQueueItem<T> = {
  job: () => Promise<T>
  restartAfter?: boolean
}

/**
 * Store for managing node pack operations and install state
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()

  const installedPacks = shallowRef<InstalledPacksResponse>({})
  const backendPacksChanged = ref(false)
  const appNeedsRestart = ref(false)

  const clientQueueItems = ref<ClientQueueItem<unknown>[]>([])
  const clientQueueLength = computed(() => clientQueueItems.value.length)

  const serverQueueStatus = ref<ManagerQueueStatus>({
    total_count: 0,
    done_count: 0,
    in_progress_count: 0,
    is_processing: false
  })
  const isServerIdle = computed(() => !serverQueueStatus.value.is_processing)

  const allJobsDone = computed(
    () => isServerIdle.value && clientQueueLength.value === 0
  )
  const nextJobReady = computed(
    () => isServerIdle.value && clientQueueLength.value > 0
  )

  const getServerQueueStatus = async () => {
    const status = await managerService.getQueueStatus()
    if (status) serverQueueStatus.value = status
  }

  const {
    isActive: isPollingActive,
    pause: pausePolling,
    resume: resumePolling
  } = useTimeoutPoll(getServerQueueStatus, QUEUE_POLL_INTERVAL_MS)

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

  const refreshInstalledPacks = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
  }

  const startNextJob = async () => {
    const nextJob = clientQueueItems.value.shift()
    if (nextJob) {
      const { job, restartAfter = false } = nextJob
      await job()
      if (restartAfter) setNeedsRestart(true)
    }
  }

  const startFirstJob = async () => {
    await startNextJob()
    if (!isPollingActive.value) resumePolling()
  }

  const onServerIdleChange = async (serverIdle: boolean) => {
    const shouldPausePolling = isPollingActive.value && allJobsDone.value
    const shouldResumePolling = !isPollingActive.value && !serverIdle

    if (shouldPausePolling) pausePolling()
    else if (shouldResumePolling) resumePolling()
    else if (nextJobReady.value) await startNextJob()
  }

  watch(isServerIdle, onServerIdleChange)
  whenever(clientQueueLength, startFirstJob)
  whenever(backendPacksChanged, refreshInstalledPacks, { immediate: true })

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

  /**
   * Set the needs restart flag, marking that the app needs to be restarted
   */
  const setNeedsRestart = (value: boolean) => {
    appNeedsRestart.value = value
  }

  return {
    // Manager state
    isLoading: managerService.isLoading,
    error: managerService.error,
    appNeedsRestart,
    statusMessage,
    allJobsDone,

    // Installed packs state
    installedPacks,
    isPackInstalled,
    isPackEnabled,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updateAllPacks,
    disablePack
  }
})
