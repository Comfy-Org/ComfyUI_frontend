<template>
  <PackActionButton
    :node-packs="nodePacks"
    :full-width="fullWidth"
    :label="
      nodePacks.length > 1
        ? $t('manager.uninstallSelected')
        : $t('manager.uninstall')
    "
    severity="danger"
    @action="uninstallItems"
  />
</template>

<script setup lang="ts">
import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type {
  ManagerPackInfo,
  PackWithSelectedVersion
} from '@/types/comfyManagerTypes'

const { nodePacks, fullWidth = false } = defineProps<{
  nodePacks: PackWithSelectedVersion[]
  fullWidth?: boolean
}>()

const managerStore = useComfyManagerStore()

const createPayload = (
  uninstallItem: PackWithSelectedVersion
): ManagerPackInfo => {
  return {
    id: uninstallItem.nodePack.id,
    version:
      uninstallItem.selectedVersion ||
      uninstallItem.nodePack.latest_version?.version
  }
}

const uninstallPack = (item: PackWithSelectedVersion) =>
  managerStore.uninstallPack(createPayload(item))

const uninstallItems = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(uninstallPack))
}
</script>
