<script setup lang="ts">
import type { PopoverContentEmits, PopoverContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const {
  class: className,
  align = 'end',
  sideOffset = 8,
  ...delegatedProps
} = defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<PopoverContentEmits>()
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :align
      :side-offset="sideOffset"
      :class="
        cn(
          'z-50 w-72 rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-4 text-primary-warm-white shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
