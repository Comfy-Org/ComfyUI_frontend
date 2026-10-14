<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  logo,
  class: className
} = defineProps<{
  label: string
  logo: string | null
  class?: string
}>()
</script>

<template>
  <span
    :class="
      cn(
        'flex max-w-full min-w-0 items-center gap-1.5 text-xs text-content-muted',
        className
      )
    "
    data-testid="model-card-provider"
  >
    <span
      v-if="logo"
      class="size-3.5 shrink-0 bg-white mask-contain mask-center mask-no-repeat"
      :style="{ maskImage: `url(${logo})` }"
      aria-hidden="true"
      data-testid="model-card-provider-logo"
    />
    <span class="truncate">{{ label }}</span>
  </span>
</template>
