<script setup lang="ts">
/* eslint-disable vue/no-unused-properties -- props forwarded via useForwardProps */
import type { AccordionItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { reactiveOmit } from '@vueuse/core'
import { AccordionItem, useForwardProps } from 'reka-ui'

const props = defineProps<
  AccordionItemProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <AccordionItem
    v-slot="slotProps"
    data-slot="accordion-item"
    v-bind="forwardedProps"
    :class="
      cn('border-b border-primary-comfy-canvas/20 last:border-b-0', props.class)
    "
  >
    <slot v-bind="slotProps" />
  </AccordionItem>
</template>
