import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { usePackUpdateStatuses } from '@/platform/customNodes/manager/composables/nodePack/usePackUpdateStatuses'

export const usePackUpdateStatus = (
  nodePackSource: MaybeRefOrGetter<components['schemas']['Node']>
) => {
  const managerStore = useComfyManagerStore()

  const nodePack = computed(() => toValue(nodePackSource))

  const { getStatus } = usePackUpdateStatuses(() => [nodePack.value])
  const status = computed(() => getStatus(nodePack.value))

  const isInstalled = computed(() => status.value.isInstalled)
  const isEnabled = computed(() =>
    managerStore.isPackEnabled(nodePack.value.id)
  )
  const installedVersion = computed(() => status.value.installedVersion)
  const latestVersion = computed(() => status.value.latestVersion)
  const isNightlyPack = computed(() => status.value.isNightly)
  const isUpdateAvailable = computed(() => status.value.isUpdateAvailable)

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
