<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  sideOffset = 6,
  ...restProps
} = defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TooltipContentEmits>()
const forwarded = useForwardPropsEmits(
  computed(() => ({ sideOffset, ...restProps })),
  emits
)
const contentStyle = useModalLiftedZIndex(computed(() => true))
</script>

<template>
  <TooltipPortal>
    <div class="pointer-events-none">
      <TooltipContent
        v-bind="forwarded"
        role="tooltip"
        :style="contentStyle"
        :class="
          cn(
            'z-1700 max-w-96 rounded-md border border-node-component-tooltip-border bg-node-component-tooltip-surface px-3 py-2 text-xs/tight text-node-component-tooltip shadow-interface',
            className
          )
        "
      >
        <div data-slot="tooltip-content">
          <slot />
        </div>
        <TooltipArrow
          :width="10"
          :height="5"
          class="fill-node-component-tooltip-surface stroke-node-component-tooltip-border"
        />
      </TooltipContent>
    </div>
  </TooltipPortal>
</template>
