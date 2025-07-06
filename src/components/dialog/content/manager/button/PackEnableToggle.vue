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

const TOGGLE_DEBOUNCE_MS = 256

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackEnabled, enablePack, disablePack, installedPacks } =
  useComfyManagerStore()

const isLoading = ref(false)

const isEnabled = computed(() => isPackEnabled(nodePack.id))
const version = computed(() => {
  const id = nodePack.id
  if (!id) return SelectedVersion.NIGHTLY
  return (
    installedPacks[id]?.ver ??
    nodePack.latest_version?.version ??
    SelectedVersion.NIGHTLY
  )
})

const handleEnable = () =>
  enablePack.call({
    id: nodePack.id,
    version: version.value,
    selected_version: version.value,
    repository: nodePack.repository ?? '',
    channel: ManagerChannel.DEFAULT,
    mode: 'default' as InstallPackParams['mode']
  })

const handleDisable = () =>
  disablePack({
    id: nodePack.id,
    version: version.value
  })

const handleToggle = async (enable: boolean) => {
  if (isLoading.value) return

  isLoading.value = true
  if (enable) {
    await handleEnable()
  } else {
    handleDisable()
  }
  isLoading.value = false
}

const onToggle = debounce(handleToggle, TOGGLE_DEBOUNCE_MS, { trailing: true })
</script>
