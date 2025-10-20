<template>
  <IconTextButton
    v-tooltip.top="
      hasDisabledUpdatePacks ? $t('manager.disabledNodesWontUpdate') : null
    "
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

import IconTextButton from '@/components/button/IconTextButton.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

type NodePack = components['schemas']['Node']

const { nodePacks, hasDisabledUpdatePacks } = defineProps<{
  nodePacks: NodePack[]
  hasDisabledUpdatePacks?: boolean
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
    isUpdating.value = false
    return
  }
  try {
    await Promise.all(updatablePacks.map(updatePack))
    managerStore.updatePack.clear()
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
