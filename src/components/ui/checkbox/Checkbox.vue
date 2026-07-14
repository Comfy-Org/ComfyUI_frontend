<template>
  <CheckboxRoot
    v-bind="forwardedProps"
    v-model="checked"
    :class="
      cn(
        'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-interface-stroke bg-transparent transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-white',
        className
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <i
        :class="
          checked === 'indeterminate'
            ? 'icon-[lucide--minus] size-3'
            : 'icon-[lucide--check] size-3'
        "
      />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<script setup lang="ts">
import type { CheckboxRootProps } from 'reka-ui'
import { CheckboxIndicator, CheckboxRoot, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

type Props = Omit<CheckboxRootProps, 'defaultValue' | 'modelValue'> & {
  class?: HTMLAttributes['class']
}

const { class: className, ...restProps } = defineProps<Props>()
const forwardedProps = useForwardProps(restProps)
const checked = defineModel<boolean | 'indeterminate'>({ default: false })
</script>
