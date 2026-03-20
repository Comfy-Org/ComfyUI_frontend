<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

const {
  text,
  side = 'top',
  sideOffset = 6,
  delayDuration = 400,
  disabled = false
} = defineProps<{
  text?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  delayDuration?: number
  disabled?: boolean
}>()
</script>
<template>
  <TooltipProvider
    :delay-duration="delayDuration"
    :disable-hoverable-content="true"
  >
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal v-if="text && !disabled">
        <TooltipContent
          :side
          :side-offset="sideOffset"
          :collision-padding="10"
          class="z-1700 max-w-75 rounded-md border border-zinc-700 bg-black px-4 py-2 text-sm/tight font-normal text-white shadow-none"
        >
          {{ text }}
          <TooltipArrow class="fill-black" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
