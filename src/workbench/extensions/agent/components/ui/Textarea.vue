<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { class: cls } = defineProps<{ class?: string }>()
const model = defineModel<string>()
</script>

<template>
  <textarea
    v-model="model"
    :class="
      cn(
        'rounded-agent text-agent-fg placeholder:text-agent-fg-subtle flex w-full resize-none bg-transparent px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        cls
      )
    "
  />
</template>
