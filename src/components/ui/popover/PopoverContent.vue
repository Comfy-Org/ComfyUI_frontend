<script setup lang="ts">
import type { PopoverContentEmits, PopoverContentProps } from 'reka-ui'
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const {
  align = 'center',
  sideOffset = 4,
  class: className,
  ...restProps
} = defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<PopoverContentEmits>()

const delegatedProps = computed(() => ({
  align,
  sideOffset,
  ...restProps
}))

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'z-50 w-72 rounded-md border bg-base-background p-4 text-base-foreground shadow-md outline-none',
          'data-[state=closed]:animate-out data-[state=open]:animate-in',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
