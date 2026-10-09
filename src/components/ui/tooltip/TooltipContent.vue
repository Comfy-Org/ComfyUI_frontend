<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  injectTooltipRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  sideOffset = 4,
  collisionPadding = 8,
  ...restProps
} = defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TooltipContentEmits>()
const forwarded = useForwardPropsEmits(
  computed(() => ({ sideOffset, collisionPadding, ...restProps })),
  emits
)
const rootContext = injectTooltipRootContext()
const contentStyle = useModalLiftedZIndex(rootContext.open)
</script>

<template>
  <TooltipPortal>
    <div v-if="rootContext.open.value" class="pointer-events-none">
      <TooltipContent
        v-bind="{ ...forwarded, ...$attrs }"
        data-slot="tooltip-content"
        data-testid="tooltip-content"
        :style="contentStyle"
        :class="
          cn(
            'z-1700 max-w-96 rounded-md border border-border-default bg-base-background px-3 py-2 text-xs/tight whitespace-pre-line text-base-foreground shadow-interface',
            className
          )
        "
        @escape-key-down="rootContext.onClose()"
      >
        <div role="tooltip"><slot /></div>
        <TooltipArrow
          :width="10"
          :height="5"
          class="-mt-px fill-base-background stroke-border-default"
        />
      </TooltipContent>
    </div>
  </TooltipPortal>
</template>
