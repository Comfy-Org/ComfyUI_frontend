<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits
} from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  closeLabel,
  class: className,
  ...delegatedProps
} = defineProps<
  DialogContentProps & { class?: HTMLAttributes['class']; closeLabel: string }
>()
const emits = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[85vh] w-[calc(100%-2rem)] -translate-1/2 gap-4 overflow-y-auto rounded-xl border border-admin-line bg-admin-card p-6 font-admin text-admin-fg shadow-admin-dialog duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-md',
          className
        )
      "
    >
      <slot />
      <DialogClose
        class="absolute top-4 right-4 grid size-8 cursor-pointer place-items-center rounded-lg text-admin-muted transition-colors outline-none hover:bg-admin-hover hover:text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg"
      >
        <X class="size-4" aria-hidden="true" />
        <span class="sr-only">{{ closeLabel }}</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
