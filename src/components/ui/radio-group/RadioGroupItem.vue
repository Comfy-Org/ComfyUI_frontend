<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { RadioGroupItemEmits, RadioGroupItemProps } from 'reka-ui'
import {
  RadioGroupIndicator,
  RadioGroupItem,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  RadioGroupItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<RadioGroupItemEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emits)
</script>

<template>
  <RadioGroupItem
    v-bind="forwarded"
    data-slot="radio-group-item"
    :class="
      cn(
        'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-default bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-background',
        props.class
      )
    "
  >
    <slot>
      <RadioGroupIndicator class="size-2 rounded-full bg-primary-background" />
    </slot>
  </RadioGroupItem>
</template>
