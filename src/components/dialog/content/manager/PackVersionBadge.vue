<template>
  <div class="relative">
    <Button
      :label="installedVersion"
      severity="secondary"
      icon="pi pi-chevron-right"
      icon-pos="right"
      class="rounded-xl text-xs tracking-tighter p-0"
      :pt="{
        label: { class: 'pl-2 pr-0 py-0.5' },
        icon: { class: 'text-xs pl-0 pr-2 py-0.5' }
      }"
      aria-haspopup="true"
      @click="toggleVersionSelector"
    />

    <Popover
      ref="popoverRef"
      :pt="{
        content: { class: 'px-0' }
      }"
    >
      <PackVersionSelectorPopover
        :installed-version="installedVersion"
        :node-pack="nodePack"
        @cancel="closeVersionSelector"
        @submit="closeVersionSelector"
      />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref, watch } from 'vue'

import PackVersionSelectorPopover from '@/components/dialog/content/manager/PackVersionSelectorPopover.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import { isSemVer } from '@/utils/formatUtil'

const TRUNCATED_HASH_LENGTH = 7

const { nodePack, isSelected } = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected: boolean
}>()

const popoverRef = ref()

const managerStore = useComfyManagerStore()

const installedVersion = computed(() => {
  if (!nodePack.id) return SelectedVersion.NIGHTLY
  const version =
    managerStore.installedPacks[nodePack.id]?.ver ??
    nodePack.latest_version?.version ??
    SelectedVersion.NIGHTLY

  // If Git hash, truncate to 7 characters
  return isSemVer(version) ? version : version.slice(0, TRUNCATED_HASH_LENGTH)
})

const toggleVersionSelector = (event: Event) => {
  popoverRef.value.toggle(event)
}

const closeVersionSelector = () => {
  popoverRef.value.hide()
}

// If the card is unselected, automatically close the version selector popover
watch(
  () => isSelected,
  (isSelected, wasSelected) => {
    if (wasSelected && !isSelected) {
      closeVersionSelector()
    }
  }
)
</script>
