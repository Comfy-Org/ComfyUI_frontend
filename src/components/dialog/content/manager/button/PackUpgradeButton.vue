<template>
  <Button
    v-if="showUpgradeButton"
    v-tooltip.top="$t('manager.update')"
    icon="pi pi-arrow-up"
    severity="primary"
    rounded
    class="p-button-sm"
    :disabled="isLoading"
    @click="handleUpgrade"
  />
  <span v-if="isLoading" class="ml-2">
    <ProgressSpinner class="w-4 h-4" />
  </span>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  type InstallPackParams,
  ManagerChannel,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const UPGRADE_DEBOUNCE_MS = 300

const { nodePack, selectedVersion } = defineProps<{
  nodePack: components['schemas']['Node']
  selectedVersion?: string
}>()

const managerStore = useComfyManagerStore()
const isLoading = ref(false)

const isInstalled = computed(() => managerStore.isPackInstalled(nodePack.id))
const installedVersion = computed(() => {
  if (!isInstalled.value) return undefined

  const id = nodePack.id
  if (!id) return undefined

  return managerStore.installedPacks[id]?.ver
})

// Show upgrade button if installed version doesn't match latest version
const showUpgradeButton = computed(() => {
  if (nodePack.latest_version?.version === SelectedVersion.NIGHTLY) {
    return false
  }

  const targetVersion =
    selectedVersion ||
    nodePack.latest_version?.version ||
    SelectedVersion.LATEST

  return installedVersion.value !== targetVersion
})

const onInstall = async () => {
  await managerStore.installPack.call({
    id: nodePack.id,
    repository: nodePack.repository ?? '',
    channel: ManagerChannel.DEFAULT,
    version: selectedVersion || SelectedVersion.LATEST,
    mode: 'default' as InstallPackParams['mode'],
    selected_version: selectedVersion || SelectedVersion.LATEST
  })
}

const handleUpgrade = debounce(onInstall, UPGRADE_DEBOUNCE_MS)
</script>
