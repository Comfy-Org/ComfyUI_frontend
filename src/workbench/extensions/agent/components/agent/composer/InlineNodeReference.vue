<script setup lang="ts">
import TagRemoveButton from '@comfyorg/design-system/chip/TagRemoveButton'

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
    <TagRemoveButton :aria-label="removeLabel" @click.stop="emit('remove')" />
  </span>
</template>
