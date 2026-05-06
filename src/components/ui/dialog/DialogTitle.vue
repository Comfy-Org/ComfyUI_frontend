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
    :class="cn('text-base font-semibold text-base-foreground', customClass)"
  >
    <slot />
  </DialogTitle>
</template>
