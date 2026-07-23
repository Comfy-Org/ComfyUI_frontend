<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'

const {
  class: className,
  variant = 'muted-textonly',
  size = 'icon-sm'
} = defineProps<{
  class?: HTMLAttributes['class']
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
}>()
</script>

<template>
  <Button
    type="button"
    data-slot="attachment-action"
    :variant="variant"
    :size="size"
    :class="className"
  >
    <slot />
  </Button>
</template>
