<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { DialogTitleProps } from 'reka-ui'
import { DialogTitle } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const { class: customClass = '', ...delegated } = defineProps<
  DialogTitleProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <DialogTitle
    v-bind="delegated"
    :class="
      cn(
        'min-w-0 text-base font-semibold wrap-break-word text-base-foreground',
        customClass
      )
    "
  >
    <slot />
  </DialogTitle>
</template>
