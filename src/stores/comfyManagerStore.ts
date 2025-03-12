import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useManagerQueue } from '@/composables/useManagerQueue'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  InstallPackParams,
  InstalledPacksResponse,
  ManagerPackInfo,
  UpdateAllPacksParams
} from '@/types/comfyManagerTypes'

/**
 * Store for state of installed node packs
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()
  const installedPacks = ref<InstalledPacksResponse>({})
  const isStale = ref(true)

  const { statusMessage, allTasksDone, enqueueTask } = useManagerQueue()

  const refreshInstalledList = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    isStale.value = false
  }

  const setStale = () => {
    isStale.value = true
  }

  whenever(isStale, refreshInstalledList, { immediate: true })

  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      enqueueTask({
        task: () => managerService.installPack(params, signal),
        onComplete: setStale
      })
    },
    { maxSize: 1 }
  )

  const uninstallPack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    installPack.clear()
    installPack.cancel()

    enqueueTask({
      task: () => managerService.uninstallPack(params, signal),
      onComplete: setStale
    })
  }

  const updatePack = useCachedRequest<ManagerPackInfo, void>(
    async (params: ManagerPackInfo, signal?: AbortSignal) => {
      updateAllPacks.clear()
      updateAllPacks.cancel()

      enqueueTask({
        task: () => managerService.updatePack(params, signal),
        onComplete: setStale
      })
    },
    { maxSize: 1 }
  )

  const updateAllPacks = useCachedRequest<UpdateAllPacksParams, void>(
    async (params: UpdateAllPacksParams, signal?: AbortSignal) => {
      enqueueTask({
        task: () => managerService.updateAllPacks(params, signal),
        onComplete: setStale
      })
    },
    { maxSize: 1 }
  )

  const disablePack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    enqueueTask({
      task: () => managerService.disablePack(params, signal),
      onComplete: setStale
    })
  }

  const isPackInstalled = (packName: string | undefined): boolean => {
    if (!packName) return false
    return !!installedPacks.value[packName]
  }

  const isPackEnabled = (packName: string | undefined): boolean => {
    if (!packName) return false
    return !!installedPacks.value[packName]?.enabled
  }

  return {
    // Manager state
    isLoading: managerService.isLoading,
    error: managerService.error,
    statusMessage,
    allTasksDone,

    // Installed packs state
    installedPacks,
    isPackInstalled,
    isPackEnabled,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updateAllPacks,
    disablePack,
    enablePack: installPack // Enable is done via install endpoint with a disabled pack
  }
})
