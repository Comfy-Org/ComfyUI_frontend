<script setup lang="ts">
import type { RadioGroupRootProps } from 'reka-ui'
import { RadioGroupRoot, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

interface Props extends Omit<
  RadioGroupRootProps,
  'modelValue' | 'defaultValue'
> {
  class?: HTMLAttributes['class']
}

const { class: customClass = '', ...restProps } = defineProps<Props>()
const modelValue = defineModel<string>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <RadioGroupRoot
    v-bind="forwardedProps"
    v-model="modelValue"
    :class="cn('flex gap-2', customClass)"
  >
    <slot />
  </RadioGroupRoot>
</template>
