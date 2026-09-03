<script setup lang="ts">
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui'
import { ToggleGroupRoot, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { provide, toRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ToggleGroupVariants } from './toggleGroup.variants'
import {
  toggleGroupVariantKey,
  toggleGroupVariants
} from './toggleGroup.variants'

interface Props extends ToggleGroupRootProps {
  class?: HTMLAttributes['class']
  variant?: ToggleGroupVariants['variant']
}

const {
  class: className,
  variant = 'default',
  ...restProps
} = defineProps<Props>()

const emits = defineEmits<ToggleGroupRootEmits>()

const forwarded = useForwardProps(restProps)

function updateModelValue(value: ToggleGroupRootEmits['update:modelValue'][0]) {
  if (restProps.required && restProps.type === 'single' && value == null) return
  emits('update:modelValue', value)
}

provide(
  toggleGroupVariantKey,
  toRef(() => variant)
)
</script>

<template>
  <ToggleGroupRoot
    v-bind="forwarded"
    :class="cn(toggleGroupVariants({ variant }), className)"
    @update:model-value="updateModelValue"
  >
    <slot />
  </ToggleGroupRoot>
</template>
