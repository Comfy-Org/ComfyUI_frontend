<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...delegatedProps } = defineProps<
  SwitchRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<SwitchRootEmits>()
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-transparency-white-t20 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-comfy-yellow',
        className
      )
    "
  >
    <SwitchThumb
      class="pointer-events-none block size-4 rounded-full bg-primary-warm-white transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-comfy-ink"
    />
  </SwitchRoot>
</template>
