<template>
  <PackActionButton
    v-bind="$attrs"
    :label="
      nodePacks.length > 1
        ? $t('manager.uninstallSelected')
        : $t('manager.uninstall')
    "
    severity="danger"
    :loading-message="$t('manager.uninstalling')"
    @action="uninstallItems"
  />
</template>

<script setup lang="ts">
import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { ManagerPackInfo } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const { nodePacks } = defineProps<{
  nodePacks: NodePack[]
}>()

const managerStore = useComfyManagerStore()

const createPayload = (uninstallItem: NodePack): ManagerPackInfo => {
  return {
    id: uninstallItem.id,
    version: uninstallItem.latest_version?.version
  }
}

const uninstallPack = (item: NodePack) =>
  managerStore.uninstallPack(createPayload(item))

const uninstallItems = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(uninstallPack))
}
</script>
