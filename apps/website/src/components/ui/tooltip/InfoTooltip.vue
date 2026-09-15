<script setup lang="ts">
import { Info } from '@lucide/vue'
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

const { text, label } = defineProps<{ text: string; label: string }>()
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <TooltipRoot>
      <TooltipTrigger
        type="button"
        :aria-label="label"
        class="inline-flex cursor-help rounded-full text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-canvas focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="info-tooltip"
      >
        <Info class="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="6"
          class="z-50 max-w-72 rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
        >
          {{ text }}
          <TooltipArrow class="fill-primary-comfy-ink-light" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
