<template>
  <div>
    <div
      class="inline-flex items-center gap-1 rounded-2xl text-xs cursor-pointer px-2 py-1"
      :class="{ 'bg-gray-100 dark-theme:bg-neutral-700': fill }"
      aria-haspopup="true"
      role="button"
      tabindex="0"
      @click="toggleVersionSelector"
      @keydown.enter="toggleVersionSelector"
      @keydown.space="toggleVersionSelector"
    >
      <i
        v-if="isUpdateAvailable"
        class="pi pi-arrow-circle-up text-blue-600"
        style="font-size: 8px"
      />
      <span>{{ installedVersion }}</span>
      <i class="pi pi-chevron-right" style="font-size: 8px" />
    </div>

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
import Popover from 'primevue/popover'
import { computed, ref, watch } from 'vue'

import PackVersionSelectorPopover from '@/components/dialog/content/manager/PackVersionSelectorPopover.vue'
import { usePackUpdateStatus } from '@/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import { isSemVer } from '@/utils/formatUtil'

const TRUNCATED_HASH_LENGTH = 7

const {
  nodePack,
  isSelected,
  fill = true
} = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected: boolean
  fill?: boolean
}>()

const { isUpdateAvailable } = usePackUpdateStatus(nodePack)
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
