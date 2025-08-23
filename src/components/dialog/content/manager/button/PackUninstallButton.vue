<template>
  <IconTextButton
    v-bind="$attrs"
    type="transparent"
    :label="
      nodePacks.length > 1
        ? $t('manager.uninstallSelected')
        : $t('manager.uninstall')
    "
    :border="true"
    :size="size"
    class="border-red-500"
    @click="uninstallItems"
  />
</template>

<script setup lang="ts">
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { ButtonSize } from '@/types/buttonTypes'
import type { ManagerPackInfo } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, size } = defineProps<{
  nodePacks: NodePack[]
  size?: ButtonSize
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
