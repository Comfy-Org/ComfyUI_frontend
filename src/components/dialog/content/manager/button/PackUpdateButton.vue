<template>
  <PackActionButton
    v-bind="$attrs"
    variant="black"
    :label="$t('manager.updateAll')"
    :loading="isUpdating"
    :loading-message="$t('g.updating')"
    @action="updateAllPacks"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
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
    id: updateItem.id,
    version: updateItem.latest_version?.version
  }
}

const updatePack = (item: NodePack) =>
  managerStore.updatePack.call(createPayload(item))

const updateAllPacks = async () => {
  if (!nodePacks?.length) return

  isUpdating.value = true

  const updatablePacks = nodePacks.filter((pack) =>
    managerStore.isPackInstalled(pack.id)
  )

  if (!updatablePacks.length) {
    isUpdating.value = false
    return
  }

  try {
    await Promise.all(updatablePacks.map(updatePack))
    managerStore.updatePack.clear()
  } catch (error) {
    console.error('Failed to update packs:', error)
  } finally {
    isUpdating.value = false
  }
}
</script>
