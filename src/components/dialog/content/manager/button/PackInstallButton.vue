<template>
  <PackActionButton
    v-bind="$attrs"
    :label="
      nodePacks.length > 1 ? $t('manager.installSelected') : $t('g.install')
    "
    severity="secondary"
    :loading-message="$t('g.installing')"
    @action="installAllPacks"
  />
</template>

<script setup lang="ts">
import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  ManagerChannel,
  ManagerDatabaseSource,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const { nodePacks } = defineProps<{
  nodePacks: NodePack[]
}>()

const managerStore = useComfyManagerStore()

const createPayload = (installItem: NodePack) => {
  const versionToInstall =
    installItem.latest_version?.version ?? SelectedVersion.NIGHTLY // Use nightly if unclaimed pack
  return {
    id: installItem.id,
    repository: installItem.repository ?? '',
    channel: ManagerChannel.DEV,
    mode: ManagerDatabaseSource.REMOTE,
    selected_version: versionToInstall,
    version: versionToInstall
  }
}

const installPack = (item: NodePack) =>
  managerStore.installPack.call(createPayload(item))

const installAllPacks = async () => {
  if (!nodePacks?.length) return
  await Promise.all(nodePacks.map(installPack))
  managerStore.installPack.clear()
}
</script>
