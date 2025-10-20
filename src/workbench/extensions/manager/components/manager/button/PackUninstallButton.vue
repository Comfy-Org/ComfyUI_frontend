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
import IconTextButton from '@/components/button/IconTextButton.vue'
import type { ButtonSize } from '@/types/buttonTypes'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, size } = defineProps<{
  nodePacks: NodePack[]
  size?: ButtonSize
}>()

const managerStore = useComfyManagerStore()

const createPayload = (
  uninstallItem: NodePack
): ManagerComponents['schemas']['ManagerPackInfo'] => {
  if (!uninstallItem.id) {
    throw new Error('Node ID is required for uninstallation')
  }

  return {
    id: uninstallItem.id,
    version: uninstallItem.latest_version?.version || 'unknown'
  }
}

const uninstallPack = (item: NodePack) =>
  managerStore.uninstallPack(createPayload(item))

const uninstallItems = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(uninstallPack))
}
</script>
