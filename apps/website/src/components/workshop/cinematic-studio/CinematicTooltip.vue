<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

const {
  text,
  side = 'top',
  disabled = false
} = defineProps<{
  text: string
  side?: 'top' | 'bottom'
  disabled?: boolean
}>()
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <TooltipRoot :disabled>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side
          :side-offset="8"
          class="z-60 max-w-64 rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
        >
          {{ text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
