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
        'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border bg-transparent text-background transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        props.class
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <slot v-bind="slotProps">
        <i
          :class="
            cn(
              'size-3',
              slotProps.state === 'indeterminate'
                ? 'icon-[lucide--minus]'
                : 'icon-[lucide--check]'
            )
          "
        />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
