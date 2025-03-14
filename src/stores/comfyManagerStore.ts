import { whenever } from '@vueuse/core'
import { partition } from 'lodash'
import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useManagerQueue } from '@/composables/useManagerQueue'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  InstallPackParams,
  InstalledPacksResponse,
  ManagerPackInfo,
  ManagerPackInstalled,
  UpdateAllPacksParams
} from '@/types/comfyManagerTypes'

/**
 * Store for state of installed node packs
 */
export const useComfyManagerStore = defineStore('comfyManager', () => {
  const managerService = useComfyManagerService()
  const installedPacks = ref<InstalledPacksResponse>({})
  const enabledPacksIds = ref<Set<string>>(new Set())
  const disabledPacksIds = ref<Set<string>>(new Set())
  const installedPacksIds = ref<Set<string>>(new Set())
  const isStale = ref(true)

  const { statusMessage, allTasksDone, enqueueTask } = useManagerQueue()

  const setStale = () => {
    isStale.value = true
  }

  /**
   * A pack is disabled if there is a disabled entry and no corresponding enabled entry
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
  const isDisabledPack = (pack: ManagerPackInstalled) =>
    pack.enabled === false && pack.cnr_id && !installedPacks.value[pack.cnr_id]

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

  watchEffect(() => {
    const packs = Object.values(installedPacks.value)
    const [disabled, enabled] = partition(packs, isDisabledPack)
    enabledPacksIds.value = packsToIdSet(enabled)
    disabledPacksIds.value = packsToIdSet(disabled)
    installedPacksIds.value = packsToIdSet(packs)
  })

  const refreshInstalledList = async () => {
    const packs = await managerService.listInstalledPacks()
    if (packs) installedPacks.value = packs
    isStale.value = false
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

  return {
    // Manager state
    isLoading: managerService.isLoading,
    error: managerService.error,
    statusMessage,
    allTasksDone,

    // Installed packs state
    installedPacks,
    installedPacksIds,
    isPackInstalled: isInstalledPackId,
    isPackEnabled: isEnabledPackId,

    // Pack actions
    installPack,
    uninstallPack,
    updatePack,
    updateAllPacks,
    disablePack,
    enablePack: installPack // Enable is done via install endpoint with a disabled pack
  }
})
