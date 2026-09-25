<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  CheckboxRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<CheckboxRootEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emits)
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    v-bind="forwarded"
    data-slot="checkbox"
    :class="
      cn(
        'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border-default bg-transparent text-base-background transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-background data-[state=checked]:bg-primary-background',
        props.class
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <slot v-bind="slotProps">
        <i class="icon-[lucide--check] size-3" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
