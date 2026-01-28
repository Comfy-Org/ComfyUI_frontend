<template>
  <div
    v-for="(logo, index) in logos"
    :key="index"
    :class="
      cn('pointer-events-none absolute', logo.position ?? defaultPosition)
    "
    :style="{ opacity: logo.opacity ?? 0.9 }"
  >
    <img
      :src="getLogoUrl(logo.provider)"
      :alt="logo.provider"
      :class="sizeClasses[logo.size ?? 'md']"
      class="drop-shadow-md"
      draggable="false"
    />
  </div>
</template>

<script setup lang="ts">
import type { LogoInfo } from '@/platform/workflow/templates/types/template'
import { cn } from '@/utils/tailwindUtil'

const {
  logos,
  getLogoUrl,
  defaultPosition = 'bottom-2 right-2'
} = defineProps<{
  logos: LogoInfo[]
  getLogoUrl: (provider: string) => string
  defaultPosition?: string
}>()

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12'
}
</script>
