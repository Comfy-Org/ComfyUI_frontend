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
import type { components } from '@/types/comfyRegistryTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

const TOGGLE_DEBOUNCE_MS = 256

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackEnabled, enablePack, disablePack } = useComfyManagerStore()

const isLoading = ref(false)

const isEnabled = computed(() => isPackEnabled(nodePack.id))

const handleEnable = () => {
  if (!nodePack.id) {
    throw new Error('Node ID is required for enabling')
  }
  return enablePack.call({
    id: nodePack.id,
    version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion']),
    selected_version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion']),
    repository: nodePack.repository ?? '',
    channel: 'default' as ManagerComponents['schemas']['ManagerChannel'],
    mode: 'cache' as ManagerComponents['schemas']['ManagerDatabaseSource'],
    skip_post_install: false
  })
}

const handleDisable = () => {
  if (!nodePack.id) {
    throw new Error('Node ID is required for disabling')
  }
  return disablePack({
    id: nodePack.id,
    version:
      nodePack.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion'])
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

const onToggle = debounce(
  (enable: boolean) => {
    void handleToggle(enable)
  },
  TOGGLE_DEBOUNCE_MS,
  { trailing: true }
)
</script>
