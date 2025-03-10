<template>
  <Button
    outlined
    class="m-0 p-0 rounded-lg border-neutral-700"
    severity="secondary"
    :class="{
      'w-full': fullWidth,
      'w-min-content': !fullWidth
    }"
    @click="installItems"
  >
    <span class="py-2.5 px-3">
      <template v-if="!managerStore.allJobsDone">
        {{ managerStore.statusMessage }}
      </template>
      <template v-else>
        {{
          packs.length > 1
            ? $t('manager.installSelected')
            : $t('manager.install')
        }}
      </template>
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onUnmounted } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  InstallPackParams,
  ManagerChannel,
  ManagerSourceMode,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

type PackWithSelectedVersion = {
  nodePack: components['schemas']['Node']
  selectedVersion?: InstallPackParams['selected_version']
}

const { packs, fullWidth = false } = defineProps<{
  packs: PackWithSelectedVersion[]
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
    selected_version: selectedVersion
  }
}

const installPack = (item: PackWithSelectedVersion) =>
  managerStore.installPack.call(createPayload(item))

const installItems = async () => {
  if (!packs?.length) return
  await Promise.all(packs.map(installPack))
}

onUnmounted(() => {
  managerStore.installPack.clear()
})
</script>
