<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

interface Props extends CheckboxRootProps {
  class?: HTMLAttributes['class']
}

const { class: className, ...restProps } = defineProps<Props>()
const emits = defineEmits<CheckboxRootEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sm border border-border-default transition-colors',
        'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary-background data-[state=checked]:bg-primary-background',
        className
      )
    "
  >
    <CheckboxIndicator
      class="flex items-center justify-center text-base-foreground"
    >
      <i class="icon-[lucide--check] size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
