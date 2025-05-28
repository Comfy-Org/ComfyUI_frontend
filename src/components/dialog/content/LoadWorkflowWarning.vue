<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    title="Missing Node Types"
    message="When loading the graph, the following node types were not found"
  />
  <ListBox
    :options="uniqueNodes"
    option-label="label"
    scroll-height="100%"
    class="comfy-missing-nodes"
    :pt="{
      list: { class: 'border-none' }
    }"
  >
    <template #option="slotProps">
      <div class="flex align-items-center">
        <span class="node-type">{{ slotProps.option.label }}</span>
        <span v-if="slotProps.option.hint" class="node-hint">{{
          slotProps.option.hint
        }}</span>
        <Button
          v-if="slotProps.option.action"
          :label="slotProps.option.action.text"
          size="small"
          outlined
          @click="slotProps.option.action.callback"
        />
      </div>
    </template>
  </ListBox>
  <div v-if="isManagerInstalled" class="flex justify-end py-3">
    <Button label="Open Manager" size="small" outlined @click="openManager" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ListBox from 'primevue/listbox'
import { computed } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useDialogService } from '@/services/dialogService'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'
import type { MissingNodeType } from '@/types/comfy'
import { ManagerTab } from '@/types/comfyManagerTypes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

const aboutPanelStore = useAboutPanelStore()

// Determines if ComfyUI-Manager is installed by checking for its badge in the about panel
// This allows us to conditionally show the Manager button only when the extension is available
// TODO: Remove this check when Manager functionality is fully migrated into core
const isManagerInstalled = computed(() => {
  return aboutPanelStore.badges.some(
    (badge) =>
      badge.label.includes('ComfyUI-Manager') ||
      badge.url.includes('ComfyUI-Manager')
  )
})

const uniqueNodes = computed(() => {
  const seenTypes = new Set()
  return props.missingNodeTypes
    .filter((node) => {
      const type = typeof node === 'object' ? node.type : node
      if (seenTypes.has(type)) return false
      seenTypes.add(type)
      return true
    })
    .map((node) => {
      if (typeof node === 'object') {
        return {
          label: node.type,
          hint: node.hint,
          action: node.action
        }
      }
      return { label: node }
    })
})

const openManager = () => {
  useDialogService().showManagerDialog({
    initialTab: ManagerTab.Missing
  })
}
</script>

<style scoped>
.comfy-missing-nodes {
  max-height: 300px;
  overflow-y: auto;
}

.node-hint {
  margin-left: 0.5rem;
  font-style: italic;
  color: var(--text-color-secondary);
}

:deep(.p-button) {
  margin-left: auto;
}
</style>
