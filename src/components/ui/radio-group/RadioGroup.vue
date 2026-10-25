<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { RadioGroupRootEmits, RadioGroupRootProps } from 'reka-ui'
import { RadioGroupRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  RadioGroupRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<RadioGroupRootEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emits)
</script>

<template>
  <RadioGroupRoot
    v-bind="forwarded"
    data-slot="radio-group"
    :class="cn('flex gap-2', props.class)"
  >
    <slot />
  </RadioGroupRoot>
</template>
