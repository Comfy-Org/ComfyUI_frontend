<script setup lang="ts">
import InlineReferenceRemoveButton from './InlineReferenceRemoveButton.vue'
import { inlineReferenceChipClass } from './inlineReferenceChipStyles'

const { title, nodeId, removeLabel } = defineProps<{
  title: string
  nodeId: string
  removeLabel: string
}>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <span tabindex="0" :class="inlineReferenceChipClass">
    <i aria-hidden="true" class="icon-[comfy--node] size-3" />
    <span class="max-w-56 min-w-0 truncate">{{ title }}</span>
    <span class="shrink-0 text-muted-foreground">{{ ` #${nodeId}` }}</span>
    <InlineReferenceRemoveButton
      :label="removeLabel"
      @remove="emit('remove')"
    />
  </span>
</template>
