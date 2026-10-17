<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { LabelProps } from 'reka-ui'
import { Label, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <Label
    v-bind="forwarded"
    data-slot="label"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class
      )
    "
  >
    <slot />
  </Label>
</template>
