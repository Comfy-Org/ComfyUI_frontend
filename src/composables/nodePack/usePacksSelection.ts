import { type Ref, computed } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

export type SelectionState = 'all-installed' | 'none-installed' | 'mixed'

/**
 * Composable for managing multi-package selection states
 * Handles installation status tracking and selection state determination
 */
export function usePacksSelection(nodePacks: Ref<NodePack[]>) {
  const managerStore = useComfyManagerStore()

  const installedPacks = computed(() =>
    nodePacks.value.filter((pack) => managerStore.isPackInstalled(pack.id))
  )

  const notInstalledPacks = computed(() =>
    nodePacks.value.filter((pack) => !managerStore.isPackInstalled(pack.id))
  )

  const isAllInstalled = computed(
    () => installedPacks.value.length === nodePacks.value.length
  )

  const isNoneInstalled = computed(
    () => notInstalledPacks.value.length === nodePacks.value.length
  )

  const isMixed = computed(
    () => installedPacks.value.length > 0 && notInstalledPacks.value.length > 0
  )

  const selectionState = computed<SelectionState>(() => {
    if (isAllInstalled.value) return 'all-installed'
    if (isNoneInstalled.value) return 'none-installed'
    return 'mixed'
  })

  return {
    installedPacks,
    notInstalledPacks,
    isAllInstalled,
    isNoneInstalled,
    isMixed,
    selectionState
  }
}
