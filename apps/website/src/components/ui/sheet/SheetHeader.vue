<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="sheet-header"
    :class="cn('flex flex-col gap-1.5 p-4', props.class)"
  >
    <slot />
  </div>
</template>
