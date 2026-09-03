<script setup lang="ts">
import type { RadioGroupItemProps } from 'reka-ui'
import { RadioGroupIndicator, RadioGroupItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

interface Props extends RadioGroupItemProps {
  class?: HTMLAttributes['class']
}

const { class: customClass = '', ...restProps } = defineProps<Props>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <RadioGroupItem
    v-bind="forwardedProps"
    :class="
      cn(
        'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-interface-stroke bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-background',
        customClass
      )
    "
  >
    <RadioGroupIndicator class="size-2 rounded-full bg-primary-background" />
  </RadioGroupItem>
</template>
