<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'

import { cn } from '../../utils/cn'

const {
  src,
  alt,
  fallback,
  class: cls
} = defineProps<{
  src?: string
  alt?: string
  fallback: string
  class?: string
}>()
</script>

<template>
  <AvatarRoot
    :class="
      cn(
        'bg-agent-surface-hover inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full select-none',
        cls
      )
    "
  >
    <AvatarImage v-if="src" :src :alt class="size-full object-cover" />
    <AvatarFallback
      class="text-agent-fg-muted flex size-full items-center justify-center text-xs font-medium"
      :delay-ms="0"
    >
      {{ fallback }}
    </AvatarFallback>
  </AvatarRoot>
</template>
