<script setup lang="ts">
import type { ContextMenuTriggerProps } from 'reka-ui'
import { ContextMenuTrigger, useForwardProps } from 'reka-ui'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardProps
const props = defineProps<ContextMenuTriggerProps>()
const forwarded = useForwardProps(props)
</script>

<template>
  <ContextMenuTrigger v-bind="forwarded">
    <slot />
  </ContextMenuTrigger>
</template>
