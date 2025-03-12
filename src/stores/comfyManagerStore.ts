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
  const appNeedsRestart = ref(false)

  const { statusMessage, allTasksDone, enqueueTask } = useManagerQueue()

  const refreshInstalledList = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    isStale.value = false
  }

  whenever(isStale, refreshInstalledList, { immediate: true })

  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      const id = params.id
      if (!id) return

      enqueueTask({
        task: () => managerService.installPack(params, signal),
        onComplete: () => {
          appNeedsRestart.value = true
          installedPacks.value[id] = {
            ver: params.version,
            cnr_id: params.id,
            aux_id: null,
            enabled: true
          }
          isStale.value = true
        }
      })
    },
    { maxSize: 1 }
  )

  const uninstallPack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    const id = params.id
    if (!id) return

    installPack.clear()
    installPack.cancel()

    enqueueTask({
      task: () => managerService.uninstallPack(params, signal),
      onComplete: () => {
        appNeedsRestart.value = true
        delete installedPacks.value[id]
        isStale.value = true
      }
    })
  }

  const updatePack = useCachedRequest<ManagerPackInfo, void>(
    async (params: ManagerPackInfo, signal?: AbortSignal) => {
      const id = params.id
      if (!id) return

      updateAllPacks.clear()

      enqueueTask({
        task: () => managerService.updatePack(params, signal),
        onComplete: () => {
          appNeedsRestart.value = true
          installedPacks.value[id].ver = params.version
          isStale.value = true
        }
      })
    },
    { maxSize: 1 }
  )

  const updateAllPacks = useCachedRequest<UpdateAllPacksParams, void>(
    async (params: UpdateAllPacksParams, signal?: AbortSignal) => {
      enqueueTask({
        task: () => managerService.updateAllPacks(params, signal),
        onComplete: () => {
          appNeedsRestart.value = true
          isStale.value = true
        }
      })
    },
    { maxSize: 1 }
  )

  const disablePack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    const id = params.id
    if (!id) return

    enqueueTask({
      task: () => managerService.disablePack(params, signal),
      onComplete: () => {
        appNeedsRestart.value = true
        installedPacks.value[id].enabled = false
        isStale.value = true
      }
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
