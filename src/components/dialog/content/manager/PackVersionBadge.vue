<template>
  <div class="relative">
    <Button
      v-if="displayVersion"
      :label="displayVersion"
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
        :selected-version="selectedVersion"
        :node-pack="nodePack"
        @select="onSelect"
        @cancel="closeVersionSelector"
        @apply="applyVersionSelection"
      />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import PackVersionSelectorPopover from '@/components/dialog/content/manager/PackVersionSelectorPopover.vue'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const { nodePack, version = SelectedVersion.NIGHTLY } = defineProps<{
  nodePack: components['schemas']['Node']
  version?: string
}>()

const emit = defineEmits<{
  'update:version': [version: string]
}>()

const popoverRef = ref()
const selectedVersion = ref<string>(version)

const displayVersion = computed(() => {
  if (selectedVersion.value === SelectedVersion.LATEST) {
    // If there is no version, treat as unclaimed GitHub pack and use nightly
    return nodePack?.latest_version?.version || SelectedVersion.NIGHTLY
  }
  return selectedVersion.value
})

const toggleVersionSelector = (event: Event) => {
  popoverRef.value.toggle(event)
}

const closeVersionSelector = () => {
  popoverRef.value.hide()
}

const onSelect = (newVersion: string) => {
  selectedVersion.value = newVersion
}

const applyVersionSelection = (newVersion: string) => {
  selectedVersion.value = newVersion
  emit('update:version', newVersion)
  // TODO: after manager store added, install the pack here
  closeVersionSelector()
}

whenever(() => version, onSelect)
</script>
