<template>
  <PackActionButton
    v-bind="$attrs"
    :label="
      nodePacks.length > 1
        ? $t('manager.uninstallSelected')
        : $t('manager.uninstall')
    "
    variant="red"
    :loading-message="$t('manager.uninstalling')"
    @action="uninstallItems"
  />
</template>
<script setup lang="ts">
import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const { nodePacks } = defineProps<{
  nodePacks: NodePack[]
}>()

const managerStore = useComfyManagerStore()

const uninstallPack = (item: NodePack) => {
  if (!item.id) {
    throw new Error('Node ID is required for uninstallation')
  }
  return managerStore.uninstallPack({
    id: item.id,
    version: item.latest_version?.version ?? ''
  })
}

const uninstallItems = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(uninstallPack))
}
</script>
