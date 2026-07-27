<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  testId,
  triggerClass,
  ringClass = 'focus-visible:ring-base-foreground',
  side = 'top',
  sideOffset = 6
} = defineProps<{
  label: string | string[]
  testId?: string
  triggerClass?: string
  ringClass?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)

const labelText = computed(() =>
  Array.isArray(label) ? label.join(', ') : label
)

const contentClass = cn(
  'z-1700 max-w-48 rounded-md bg-charcoal-300 px-3 py-2',
  'text-xs text-white shadow-interface will-change-[transform,opacity]',
  'data-[state=closed]:animate-out data-[state=open]:animate-in',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
)
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <TooltipRoot v-model:open="open" disable-closing-trigger>
      <TooltipTrigger as-child>
        <button
          type="button"
          :aria-label="labelText"
          :data-testid="testId"
          :class="
            cn(
              'cursor-pointer border-none bg-transparent p-0 focus-visible:ring-1 focus-visible:outline-none',
              ringClass,
              triggerClass
            )
          "
          @click.stop="open = true"
        >
          <slot />
        </button>
      </TooltipTrigger>
      <TooltipPortal>
        <!-- aria-label=" " stops reka duplicating the label as a description -->
        <TooltipContent
          :side
          :side-offset
          aria-hidden
          aria-label=" "
          data-testid="disclosure-tooltip"
          :style="contentStyle"
          :class="contentClass"
        >
          {{ labelText }}
          <TooltipArrow :width="10" :height="5" class="fill-charcoal-300" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
