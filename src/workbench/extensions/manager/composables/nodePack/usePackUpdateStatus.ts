import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { getPackUpdateStatus } from '@/workbench/extensions/manager/utils/packUpdateStatus'

export const usePackUpdateStatus = (
  nodePackSource: MaybeRefOrGetter<components['schemas']['Node']>
) => {
  const managerStore = useComfyManagerStore()

  // Use toValue to unwrap the source reactively inside computeds
  const nodePack = computed(() => toValue(nodePackSource))

  const status = computed(() =>
    getPackUpdateStatus(nodePack.value, managerStore)
  )

  const isInstalled = computed(() => status.value.isInstalled)
  const isEnabled = computed(() =>
    managerStore.isPackEnabled(nodePack.value?.id)
  )
  const installedVersion = computed(() => status.value.installedVersion)
  const latestVersion = computed(() => status.value.latestVersion)
  const isNightlyPack = computed(() => status.value.isNightly)
  const isUpdateAvailable = computed(() => status.value.isUpdateAvailable)

  /**
   * Nightly packs can always "try update" since we cannot compare git hashes
   * to determine if an update is actually available. This allows users to
   * pull the latest changes from the repository.
   */
  const canTryNightlyUpdate = computed(
    () => isInstalled.value && isEnabled.value && isNightlyPack.value
  )

  return {
    isUpdateAvailable,
    isNightlyPack,
    canTryNightlyUpdate,
    installedVersion,
    latestVersion
  }
}
