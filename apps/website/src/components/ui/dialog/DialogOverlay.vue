<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import type { DialogOverlayProps } from 'reka-ui'
import { DialogOverlay } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const props = defineProps<
  DialogOverlayProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    :class="
      cn(
        'fixed inset-0 z-50 bg-transparency-ink-t80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        props.class
      )
    "
    v-bind="delegatedProps"
  >
    <slot />
  </DialogOverlay>
</template>
