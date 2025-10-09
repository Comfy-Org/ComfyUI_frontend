<template>
  <div>
    <div
      v-tooltip.top="
        isDisabled ? $t('manager.enablePackToChangeVersion') : null
      "
      class="inline-flex items-center gap-1 rounded-2xl py-1 text-xs"
      :class="{
        'bg-dialog-surface px-1.5': fill,
        'cursor-pointer': !isDisabled,
        'cursor-not-allowed opacity-60': isDisabled
      }"
      :aria-haspopup="!isDisabled"
      :role="isDisabled ? 'text' : 'button'"
      :tabindex="isDisabled ? -1 : 0"
      @click="!isDisabled && toggleVersionSelector($event)"
      @keydown.enter="!isDisabled && toggleVersionSelector($event)"
      @keydown.space="!isDisabled && toggleVersionSelector($event)"
    >
      <i
        v-if="isUpdateAvailable"
        class="pi pi-arrow-circle-up text-xs text-blue-600"
      />
      <span>{{ installedVersion }}</span>
      <i v-if="!isDisabled" class="pi pi-chevron-right text-xxs" />
    </div>

    <Popover
      ref="popoverRef"
      :pt="{
        content: { class: 'p-0 shadow-lg' }
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
import { valid as validSemver } from 'semver'
import { computed, ref, watch } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import PackVersionSelectorPopover from '@/workbench/extensions/manager/components/manager/PackVersionSelectorPopover.vue'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

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

const isInstalled = computed(() => managerStore.isPackInstalled(nodePack?.id))
const isDisabled = computed(
  () => isInstalled.value && !managerStore.isPackEnabled(nodePack?.id)
)

const installedVersion = computed(() => {
  if (!nodePack.id) return 'nightly'
  const version =
    managerStore.installedPacks[nodePack.id]?.ver ??
    nodePack.latest_version?.version ??
    'nightly'

  // If Git hash, truncate to 7 characters
  return validSemver(version)
    ? version
    : version.slice(0, TRUNCATED_HASH_LENGTH)
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
