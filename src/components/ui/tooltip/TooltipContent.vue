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

import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const {
  sideOffset = 4,
  class: className,
  arrowClass,
  ...restProps
} = defineProps<
  TooltipContentProps & {
    class?: HTMLAttributes['class']
    arrowClass?: HTMLAttributes['class']
  }
>()
const emits = defineEmits<TooltipContentEmits>()

const delegatedProps = computed(() => ({
  sideOffset,
  ...restProps
}))

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'z-50 w-fit rounded-md border bg-base-background px-3 py-1.5 text-sm text-base-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )
      "
    >
      <slot />
      <TooltipArrow
        :class="cn('fill-base-background', arrowClass)"
        :width="10"
        :height="5"
      />
    </TooltipContent>
  </TooltipPortal>
</template>
