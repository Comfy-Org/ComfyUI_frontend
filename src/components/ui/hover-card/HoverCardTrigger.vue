<script setup lang="ts">
import { HoverCardTrigger, useForwardProps } from 'reka-ui'
import type { HoverCardTriggerProps } from 'reka-ui'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardProps
const props = defineProps<HoverCardTriggerProps>()
const forwarded = useForwardProps(props)
</script>

<template>
  <HoverCardTrigger v-bind="forwarded">
    <slot />
  </HoverCardTrigger>
</template>
