<template>
  <Button
    v-if="showUpgradeButton"
    v-tooltip.top="$t('manager.update')"
    icon="pi pi-arrow-up"
    severity="primary"
    rounded
    class="p-button-sm"
    :disabled="isLoading"
    @click="upgradePack"
  />
  <span v-if="isLoading" class="ml-2">
    <ProgressSpinner class="w-4 h-4" />
  </span>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const UPGRADE_DEBOUNCE_MS = 300

const { nodePack, selectedVersion } = defineProps<{
  nodePack: components['schemas']['Node']
  selectedVersion?: string
}>()

const managerStore = useComfyManagerStore()
const isLoading = ref(false)

// Show upgrade button if installed version doesn't match latest or selected version
const showUpgradeButton = computed(() => {
  const isInstalled = managerStore.isPackInstalled(nodePack.id)
  if (!isInstalled) return false

  const installedVersion = managerStore.installedPacks[nodePack.id]?.ver
  const targetVersion =
    selectedVersion ||
    nodePack.latest_version?.version ||
    SelectedVersion.LATEST

  return installedVersion !== targetVersion
})

const upgradePack = useDebounceFn(async () => {
  if (isLoading.value) return

  isLoading.value = true
  await managerStore.installPack.call({
    id: nodePack.id,
    selected_version: selectedVersion || SelectedVersion.LATEST
  })
  isLoading.value = false
}, UPGRADE_DEBOUNCE_MS)
</script>
