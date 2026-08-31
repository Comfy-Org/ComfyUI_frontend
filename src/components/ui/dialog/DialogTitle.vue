<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui'
import { DialogTitle } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

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
