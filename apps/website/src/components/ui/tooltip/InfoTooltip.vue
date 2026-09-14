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
        class="focus-visible:ring-primary-comfy-yellow/50 inline-flex cursor-help rounded-full text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-canvas focus-visible:ring-3"
        data-testid="info-tooltip"
      >
        <Info class="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="6"
          class="bg-primary-comfy-ink-light z-50 max-w-72 rounded-xl border border-transparency-white-t8 px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
        >
          {{ text }}
          <TooltipArrow class="fill-primary-comfy-ink-light" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
