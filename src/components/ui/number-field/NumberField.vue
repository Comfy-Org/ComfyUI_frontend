<script setup lang="ts">
import type { NumberFieldRootProps } from 'reka-ui'
import { NumberFieldRoot, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  locale,
  stepSnapping = false,
  disableWheelChange = true,
  ...restProps
} = defineProps<NumberFieldRootProps & { class?: HTMLAttributes['class'] }>()

const emits = defineEmits<{
  'update:modelValue': [value: number]
}>()

const forwarded = useForwardProps(restProps)
const { locale: appLocale } = useI18n()

function updateModelValue(value: number | undefined) {
  if (value === undefined || value === restProps.modelValue) return
  emits('update:modelValue', value)
}
</script>

<template>
  <NumberFieldRoot
    v-slot="slotProps"
    v-bind="forwarded"
    :locale="locale ?? appLocale"
    data-slot="number-field"
    :step-snapping="stepSnapping"
    :disable-wheel-change="disableWheelChange"
    :class="
      cn(
        'flex h-10 w-full items-center rounded-lg bg-secondary-background text-base-foreground focus-within:ring-1 focus-within:ring-border-default hover:bg-secondary-background-hover data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )
    "
    @update:model-value="updateModelValue"
  >
    <slot v-bind="slotProps" />
  </NumberFieldRoot>
</template>
