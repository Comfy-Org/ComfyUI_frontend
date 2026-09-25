<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'

import type { InputGroupButtonVariants } from './inputGroup.variants'
import { inputGroupButtonVariants } from './inputGroup.variants'

const {
  variant = 'muted-textonly',
  size = 'xs',
  class: className
} = defineProps<{
  variant?: ButtonVariants['variant']
  size?: InputGroupButtonVariants['size']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <Button
    type="button"
    data-slot="input-group-button"
    :data-size="size"
    :variant
    size="unset"
    :class="cn(inputGroupButtonVariants({ size }), className)"
  >
    <slot />
  </Button>
</template>
