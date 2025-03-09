<template>
  <Button
    outlined
    class="m-0 p-0 rounded-lg border-neutral-700"
    severity="secondary"
    :class="{
      'w-full': fullWidth,
      'w-min-content': !fullWidth
    }"
    @click="handleInstall"
  >
    <span class="py-2.5 px-3">
      <template v-if="!managerStore.isIdle">
        {{ statusMessage }}
      </template>
      <template v-else>
        {{ isMultiItem ? $t('manager.installSelected') : $t('g.install') }}
      </template>
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onUnmounted } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { ManagerChannel, ManagerSourceMode } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

type InstallItem = {
  nodePack: components['schemas']['Node']
  version?: string
}

const { items, fullWidth = false } = defineProps<{
  items: InstallItem[]
  fullWidth?: boolean
}>()

const managerStore = useComfyManagerStore()

const statusMessage = computed(() => managerStore.statusMessage)
const isMultiItem = computed(() => items?.length > 1)

const comfyApiToManager = (nodePack: components['schemas']['Node']) => {
  return {
    id: nodePack.id,
    repository: nodePack.repository,
    channel: ManagerChannel.DEFAULT,
    mode: ManagerSourceMode.CACHE
  }
}

const installPack = (item: InstallItem) =>
  managerStore.installPack.call({
    ...comfyApiToManager(item.nodePack),
    selected_version: item.version ?? item.nodePack.latest_version?.version,
    version: item.version ?? item.nodePack.latest_version?.version
  })

const handleInstall = async () => {
  await Promise.all(items.map(installPack))
}

onUnmounted(() => {
  managerStore.installPack.clear()
})
</script>
