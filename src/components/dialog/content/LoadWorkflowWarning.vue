<template>
  <div class="comfy-missing-nodes">
    <h4 class="warning-title">Warning: Missing Node Types</h4>
    <p class="warning-description">
      When loading the graph, the following node types were not found:
    </p>
    <ListBox
      :options="uniqueNodes"
      optionLabel="label"
      scrollHeight="100%"
      :class="'missing-nodes-list' + (props.maximized ? ' maximized' : '')"
      :pt="{
        list: { class: 'border-none' }
      }"
    >
      <template #option="slotProps">
        <div class="missing-node-item">
          <span class="node-type">{{ slotProps.option.label }}</span>
          <span v-if="slotProps.option.hint" class="node-hint">{{
            slotProps.option.hint
          }}</span>
          <Button
            v-if="slotProps.option.action"
            @click="slotProps.option.action.callback"
            :label="slotProps.option.action.text"
            class="p-button-sm p-button-outlined"
          />
        </div>
      </template>
    </ListBox>
    <p v-if="hasAddedNodes" class="added-nodes-warning">
      Nodes that have failed to load will show as red on the graph.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ListBox from 'primevue/listbox'
import Button from 'primevue/button'

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
  hasAddedNodes: boolean
  maximized: boolean
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

<style>
:root {
  --red-600: #dc3545;
}
</style>

<style scoped>
.comfy-missing-nodes {
  font-family: monospace;
  color: var(--red-600);
  padding: 1.5rem;
  background-color: var(--surface-ground);
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
}

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

.missing-nodes-list.maximized {
  max-height: unset;
}

.missing-node-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
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

.added-nodes-warning {
  margin-top: 1rem;
  font-style: italic;
}
</style>
