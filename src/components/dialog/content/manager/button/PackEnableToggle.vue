<template>
  <div class="flex items-center">
    <ToggleSwitch
      :model-value="isEnabled"
      :disabled="isLoading"
      aria-label="Enable or disable pack"
      @update:model-value="handleToggle"
    />
    <span v-if="isLoading" class="ml-2">
      <ProgressSpinner class="w-4 h-4" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import ProgressSpinner from 'primevue/progressspinner'
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

// Enable is done by using the install endpoint with a disabled pack
const onEnable = async () => {
  const id = nodePack.id
  if (!id) return

  managerStore.installPack.call({
    id,
    version:
      managerStore.installedPacks[id]?.ver ??
      nodePack.latest_version?.version ??
      SelectedVersion.NIGHTLY,
    selected_version:
      managerStore.installedPacks[id]?.ver ??
      nodePack.latest_version?.version ??
      SelectedVersion.NIGHTLY,
    repository: nodePack.repository ?? '',
    channel: ManagerChannel.DEFAULT,
    mode: 'default' as InstallPackParams['mode']
  })
}

const onDisable = async () => {
  const id = nodePack.id
  if (!id) return

  managerStore.disablePack({
    id,
    version: managerStore.installedPacks[id]?.ver
  })
}

const onToggle = async (enable: boolean) => {
  if (isLoading.value) return

  isLoading.value = true
  if (enable) {
    await onEnable()
  } else {
    await onDisable()
  }
  isLoading.value = false
}

const handleToggle = debounce(onToggle, TOGGLE_DEBOUNCE_MS)
</script>
