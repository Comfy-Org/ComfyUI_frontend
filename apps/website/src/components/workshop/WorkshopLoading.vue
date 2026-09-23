<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Loader2 } from '@lucide/vue'

const { label, minh = true } = defineProps<{
  label: string
  minh?: boolean
}>()
</script>

<template>
  <div
    role="status"
    :aria-label="label"
    :class="
      cn(
        'flex flex-col items-center justify-center gap-4 p-6 text-center noscript:hidden',
        minh && 'min-h-svh'
      )
    "
    data-testid="workshop-loading"
  >
    <Loader2
      class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    <p class="text-sm text-primary-warm-white">{{ label }}</p>
  </div>
</template>
