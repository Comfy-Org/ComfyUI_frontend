<template>
  <div class="flex items-center">
    <ToggleSwitch
      :model-value="isEnabled"
      :disabled="isLoading"
      aria-label="Enable or disable pack"
      @update:model-value="togglePackState"
    />
    <span v-if="isLoading" class="ml-2">
      <ProgressSpinner class="w-4 h-4" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import ProgressSpinner from 'primevue/progressspinner'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const TOGGLE_DEBOUNCE_MS = 300

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const managerStore = useComfyManagerStore()
const isLoading = ref(false)
const isEnabled = computed(() => managerStore.isPackEnabled(nodePack.id))

const togglePackState = useDebounceFn(async (newValue: boolean) => {
  if (isLoading.value) return

  isLoading.value = true
  if (!newValue) {
    // Disable the pack
    managerStore.disablePack({
      id: nodePack.id,
      version: managerStore.installedPacks[nodePack.id]?.ver
    })
  } else {
    // Re-enabling is done by using install endpoint with a disabled pack
    await managerStore.installPack.call({
      id: nodePack.id,
      selected_version:
        managerStore.installedPacks[nodePack.id]?.ver || SelectedVersion.LATEST,
      version: managerStore.installedPacks[nodePack.id]?.ver
    })
  }
  isLoading.value = false
}, TOGGLE_DEBOUNCE_MS)
</script>
