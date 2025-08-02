<template>
  <IconTextButton
    v-bind="$attrs"
    type="transparent"
    :label="$t('manager.updateAll')"
    :border="true"
    size="sm"
    :disabled="isUpdating"
    @click="updateAllPacks"
  >
    <template v-if="isUpdating" #icon>
      <DotSpinner duration="1s" :size="12" />
    </template>
  </IconTextButton>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']
const { nodePacks } = defineProps<{
  nodePacks: NodePack[]
}>()
const isUpdating = ref<boolean>(false)
const managerStore = useComfyManagerStore()
const createPayload = (updateItem: NodePack) => {
  return {
    id: updateItem.id!,
    version: updateItem.latest_version!.version!
  }
}
const updatePack = async (item: NodePack) => {
  if (!item.id || !item.latest_version?.version) {
    console.warn('Pack missing required id or version:', item)
    return
  }
  await managerStore.updatePack.call(createPayload(item))
}
const updateAllPacks = async () => {
  if (!nodePacks?.length) {
    console.warn('No packs provided for update')
    return
  }
  isUpdating.value = true
  const updatablePacks = nodePacks.filter((pack) =>
    managerStore.isPackInstalled(pack.id)
  )
  if (!updatablePacks.length) {
    console.info('No installed packs available for update')
    isUpdating.value = false
    return
  }
  console.info(`Starting update of ${updatablePacks.length} packs`)
  try {
    await Promise.all(updatablePacks.map(updatePack))
    managerStore.updatePack.clear()
    console.info('All packs updated successfully')
  } catch (error) {
    console.error('Pack update failed:', error)
    console.error(
      'Failed packs info:',
      updatablePacks.map((p) => p.id)
    )
  } finally {
    isUpdating.value = false
  }
}
</script>
