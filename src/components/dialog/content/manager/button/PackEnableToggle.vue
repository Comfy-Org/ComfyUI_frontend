<template>
  <div class="flex items-center">
    <ToggleSwitch
      :model-value="isEnabled"
      :disabled="isLoading"
      aria-label="Enable or disable pack"
      @update:model-value="onToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  InstallPackParams,
  ManagerChannel,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const TOGGLE_DEBOUNCE_MS = 300

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const managerStore = useComfyManagerStore()
const isLoading = ref(false)

const isEnabled = computed(() => managerStore.isPackEnabled(nodePack.id))
const version = computed(() => {
  const id = nodePack.id
  if (!id) return SelectedVersion.NIGHTLY
  return (
    managerStore.installedPacks[id]?.ver ??
    nodePack.latest_version?.version ??
    SelectedVersion.NIGHTLY
  )
})

const handleEnable = async () => {
  if (!nodePack.id) return

  // Enable is done by using the install endpoint with a disabled pack
  managerStore.installPack.call({
    id: nodePack.id,
    version: version.value,
    selected_version: version.value,
    repository: nodePack.repository ?? '',
    channel: ManagerChannel.DEFAULT,
    mode: 'default' as InstallPackParams['mode']
  })
}

const handleDisable = async () => {
  managerStore.disablePack({
    id: nodePack.id,
    version: version.value
  })
}

const handleToggle = async (enable: boolean) => {
  if (isLoading.value) return

  isLoading.value = true
  if (enable) {
    await handleEnable()
  } else {
    await handleDisable()
  }
  isLoading.value = false
}

const onToggle = debounce(handleToggle, TOGGLE_DEBOUNCE_MS)
</script>
