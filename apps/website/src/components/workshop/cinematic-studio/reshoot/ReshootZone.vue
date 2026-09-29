<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { ReshootZone } from '../../../../lib/workshop/cinematic-studio/reshoot'

const { zone, dotOnly = false } = defineProps<{
  zone: ReshootZone
  dotOnly?: boolean
}>()

const DOT: Readonly<Record<ReshootZone, string>> = {
  green: 'bg-primary-comfy-yellow',
  yellow: 'bg-primary-comfy-orange',
  red: 'bg-primary-comfy-red'
}
</script>

<template>
  <span class="flex items-start gap-2">
    <span
      :class="cn('mt-1 size-2 shrink-0 rounded-full', DOT[zone])"
      aria-hidden="true"
    />
    <span v-if="!dotOnly" class="text-xs/relaxed text-primary-comfy-canvas">
      <slot />
    </span>
  </span>
</template>
