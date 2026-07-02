<script setup lang="ts">
/* eslint-disable vue/no-unused-properties -- props forwarded via useForwardPropsEmits */
import type { AccordionRootEmits, AccordionRootProps } from 'reka-ui'
import { AccordionRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<AccordionRootProps>()
const emits = defineEmits<AccordionRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <AccordionRoot v-slot="slotProps" data-slot="accordion" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </AccordionRoot>
</template>
