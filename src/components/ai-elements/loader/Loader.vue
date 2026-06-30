<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <i
    :class="
      cn(
        'icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground',
        className
      )
    "
  />
</template>
