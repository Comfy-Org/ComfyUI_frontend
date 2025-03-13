import { whenever } from '@vueuse/core'
import { cloneDeep } from 'lodash'
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
    const currentInstalledPacks = cloneDeep(installedPacks.value)
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    isStale.value = false

    // For debugging: find the diff between the last installed packs and the current installed packs
    for (const [key, value] of Object.entries(currentInstalledPacks)) {
      // Check if gone
      if (!packs?.[key]) {
        console.log('%c gone', 'color: red', key, value)
      }
      // Check if enabled status changed
      else if (currentInstalledPacks[key]?.enabled !== value.enabled) {
        console.log('%c enabled changed', 'color: yellow', key, value)
      }
      // Check if version changed
      else if (currentInstalledPacks[key]?.ver !== value.ver) {
        console.log('%c version changed', 'color: blue', key, value)
      }
    }

    if (packs) {
      for (const [key, value] of Object.entries(packs)) {
        if (!currentInstalledPacks[key]) {
          console.log('%c new', 'color: green', key, value)
        }
      }
    }
  }

  const setStale = () => {
    console.log('setStale')
    isStale.value = true
  }

  whenever(isStale, refreshInstalledList, { immediate: true })

  const installPack = useCachedRequest<InstallPackParams, void>(
    async (params: InstallPackParams, signal?: AbortSignal) => {
      console.log('installPack', params)
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
    console.log('uninstallPack', params)
    enqueueTask({
      task: () => managerService.uninstallPack(params, signal),
      onComplete: setStale
    })
  }

  const updatePack = useCachedRequest<ManagerPackInfo, void>(
    async (params: ManagerPackInfo, signal?: AbortSignal) => {
      console.log('updatePack', params)
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
      console.log('updateAllPacks', params)
      enqueueTask({
        task: () => managerService.updateAllPacks(params, signal),
        onComplete: setStale
      })
    },
    { maxSize: 1 }
  )

  const disablePack = (params: ManagerPackInfo, signal?: AbortSignal) => {
    console.log('disablePack', params)
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
