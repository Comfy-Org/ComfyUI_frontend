<template>
  <SwitchRoot
    v-bind="forwardedProps"
    v-model="checked"
    :class="
      cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-interface-stroke',
        className
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-3.5' : 'translate-x-0'
        )
      "
    />
  </SwitchRoot>
</template>

<script setup lang="ts">
import type { SwitchRootProps } from 'reka-ui'
import { SwitchRoot, SwitchThumb, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

type Props = Omit<SwitchRootProps, 'defaultValue' | 'modelValue'> & {
  class?: HTMLAttributes['class']
}

const { class: className, ...restProps } = defineProps<Props>()
const forwardedProps = useForwardProps(restProps)
const checked = defineModel<boolean>({ default: false })
</script>
