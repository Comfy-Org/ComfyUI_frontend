<script setup lang="ts">
import type { DialogRootEmits, DialogRootProps } from 'reka-ui'
import { DialogRoot } from 'reka-ui'

const props = defineProps<DialogRootProps>()
const emit = defineEmits<DialogRootEmits>()
</script>

<template>
  <DialogRoot v-bind="props" @update:open="(open) => emit('update:open', open)">
    <slot />
  </DialogRoot>
</template>
