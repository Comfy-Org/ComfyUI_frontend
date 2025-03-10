import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useManagerQueue } from '@/composables/useManagerQueue'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  InstallPackParams,
  InstalledPacksResponse,
  ManagerPackInfo
} from '@/types/comfyManagerTypes'

/**
 * Store for managing node pack operations and install state
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()
  const installedPacks = shallowRef<InstalledPacksResponse>({})
  const shouldRefreshInstalled = ref(true)

  const { appNeedsRestart, statusMessage, allJobsDone, enqueueJob } =
    useManagerQueue()

  const refreshInstalledPacks = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    shouldRefreshInstalled.value = false
  }

  whenever(shouldRefreshInstalled, refreshInstalledPacks, { immediate: true })

  /**
   * Install pack
   */
  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      enqueueJob({
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
      enqueueJob({
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
      enqueueJob({
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
    enqueueJob({
      job: () => managerService.uninstallPack(params, signal),
      restartAfter: true
    })
  }

  /**
   * Disable pack
   */
  const disablePack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    enqueueJob({
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
