<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import { DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import SheetClose from './SheetClose.vue'
import SheetOverlay from './SheetOverlay.vue'

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes['class']
  side?: 'top' | 'right' | 'bottom' | 'left'
  closeLabel: string
}

defineOptions({
  inheritAttrs: false
})

const {
  side = 'right',
  closeLabel,
  class: classProp,
  ...delegatedProps
} = defineProps<SheetContentProps>()
const emits = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <SheetOverlay />
    <DialogContent
      data-slot="sheet-content"
      :class="
        cn(
          'fixed z-50 flex flex-col gap-4 bg-primary-comfy-ink transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-3/4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
          side === 'top' &&
            'inset-x-0 top-0 h-auto data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
          side === 'bottom' &&
            'inset-x-0 bottom-0 h-auto data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          classProp
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <SheetClose
        class="focus:ring-primary-comfy-yellow/50 text-primary-comfy-yellow border-primary-comfy-yellow absolute top-4 right-4 rounded-xl border p-2 ring-offset-primary-comfy-ink transition-opacity focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <X class="size-6" />
        <span class="sr-only">{{ closeLabel }}</span>
      </SheetClose>
    </DialogContent>
  </DialogPortal>
</template>
