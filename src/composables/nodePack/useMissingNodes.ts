import { computed, onMounted } from 'vue'

import { useWorkflowPacks } from '@/composables/nodePack/useWorkflowPacks'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

/**
 * Composable to find missing NodePacks from workflow
 * Uses the same filtering approach as ManagerDialogContent.vue
 * Automatically fetches workflow pack data when initialized
 */
export const useMissingNodes = () => {
  const comfyManagerStore = useComfyManagerStore()
  const { workflowPacks, isLoading, error, startFetchWorkflowPacks } =
    useWorkflowPacks()

  // Same filtering logic as ManagerDialogContent.vue
  const filterMissingPacks = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => !comfyManagerStore.isPackInstalled(pack.id))

  // Filter only uninstalled packs from workflow packs
  const missingNodePacks = computed(() => {
    if (!workflowPacks.value.length) return []
    return filterMissingPacks(workflowPacks.value)
  })

  // Automatically fetch workflow pack data when composable is used
  onMounted(async () => {
    if (!workflowPacks.value.length && !isLoading.value) {
      await startFetchWorkflowPacks()
    }
  })

  return {
    missingNodePacks,
    isLoading,
    error
  }
}
