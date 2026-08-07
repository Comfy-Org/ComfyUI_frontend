<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import { DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import DialogClose from './DialogClose.vue'
import DialogOverlay from './DialogOverlay.vue'

interface DialogContentPropsWithClass extends DialogContentProps {
  class?: HTMLAttributes['class']
  closeLabel: string
}

defineOptions({
  inheritAttrs: false
})

const {
  closeLabel,
  class: classProp,
  ...delegatedProps
} = defineProps<DialogContentPropsWithClass>()
const emits = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      :class="
        cn(
          'bg-primary-comfy-ink-light border-primary-comfy-yellow rounded-5xl fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] -translate-1/2 overflow-y-auto border p-6 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg sm:p-8 lg:p-12',
          classProp
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <DialogClose
        class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 absolute top-6 right-6 inline-flex size-12 cursor-pointer items-center justify-center rounded-2xl bg-transparency-white-t8 text-primary-warm-white transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none lg:top-9 lg:right-9"
      >
        <X class="size-6" />
        <span class="sr-only">{{ closeLabel }}</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
