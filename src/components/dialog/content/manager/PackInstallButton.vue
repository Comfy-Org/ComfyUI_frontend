<template>
  <PackActionButton
    :node-packs="nodePacks"
    :full-width="fullWidth"
    :label="
      nodePacks.length > 1
        ? $t('manager.installSelected')
        : $t('manager.install')
    "
    severity="secondary"
    @action="installItems"
  />
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'

import PackActionButton from '@/components/dialog/content/manager/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  ManagerChannel,
  ManagerSourceMode,
  PackWithSelectedVersion,
  SelectedVersion
} from '@/types/comfyManagerTypes'

const { nodePacks, fullWidth = false } = defineProps<{
  nodePacks: PackWithSelectedVersion[]
  fullWidth?: boolean
}>()

const managerStore = useComfyManagerStore()

const createPayload = (installItem: PackWithSelectedVersion) => {
  const selectedVersion =
    installItem.selectedVersion ??
    installItem.nodePack.latest_version?.version ??
    SelectedVersion.LATEST

  return {
    id: installItem.nodePack.id,
    repository: installItem.nodePack.repository,
    channel: ManagerChannel.DEFAULT,
    mode: ManagerSourceMode.CACHE,
    selected_version: selectedVersion,
    version: selectedVersion
  }
}

const installPack = (item: PackWithSelectedVersion) =>
  managerStore.installPack.call(createPayload(item))

const installItems = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(installPack))
}

onUnmounted(() => {
  managerStore.installPack.clear()
})
</script>
