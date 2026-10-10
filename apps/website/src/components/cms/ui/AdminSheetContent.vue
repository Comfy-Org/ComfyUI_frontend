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
      class="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-admin-line bg-admin-card font-admin text-admin-fg shadow-admin-drawer data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:slide-in-from-right sm:max-w-xl',
          className
        )
      "
    >
      <slot />
      <DialogClose
        class="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center rounded-lg text-admin-muted transition-colors outline-none hover:bg-admin-hover hover:text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg"
      >
        <X class="size-4" aria-hidden="true" />
        <span class="sr-only">{{ closeLabel }}</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
