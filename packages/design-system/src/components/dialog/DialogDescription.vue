<script setup lang="ts">
import type { DialogDescriptionProps } from 'reka-ui'
import { DialogDescription } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '', ...delegated } = defineProps<
  DialogDescriptionProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <DialogDescription
    v-bind="delegated"
    :class="cn('text-sm text-muted-foreground', customClass)"
  >
    <slot />
  </DialogDescription>
</template>
