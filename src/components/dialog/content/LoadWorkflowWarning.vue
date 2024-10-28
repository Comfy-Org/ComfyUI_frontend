<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    title="Missing Node Types"
    message="When loading the graph, the following node types were not found"
  />
  <ListBox
    :options="uniqueNodes"
    optionLabel="label"
    scrollHeight="100%"
    class="missing-nodes-list comfy-missing-nodes"
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
          @click="slotProps.option.action.callback"
          :label="slotProps.option.action.text"
          size="small"
          outlined
        />
      </div>
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ListBox from 'primevue/listbox'
import Button from 'primevue/button'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'

interface NodeType {
  type: string
  hint?: string
  action?: {
    text: string
    callback: () => void
  }
}

const props = defineProps<{
  missingNodeTypes: (string | NodeType)[]
}>()

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
</script>

<style scoped>
.warning-title {
  margin-top: 0;
  margin-bottom: 1rem;
}

.warning-description {
  margin-bottom: 1rem;
}

.missing-nodes-list {
  max-height: 300px;
  overflow-y: auto;
}

.node-type {
  font-weight: 600;
  color: var(--text-color);
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
