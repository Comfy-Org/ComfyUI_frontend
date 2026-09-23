<script setup lang="ts">
import { HoverCardTrigger, useForwardProps } from 'reka-ui'
import type { HoverCardTriggerProps } from 'reka-ui'

const props = defineProps<HoverCardTriggerProps>()
const forwarded = useForwardProps(props)
</script>

<template>
  <HoverCardTrigger v-bind="forwarded">
    <slot />
  </HoverCardTrigger>
</template>
