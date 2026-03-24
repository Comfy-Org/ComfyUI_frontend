<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import type { ContextMenuTriggerProps } from 'reka-ui'
import { ContextMenuTrigger, useForwardProps } from 'reka-ui'

const props = defineProps<ContextMenuTriggerProps>()

const forwardedProps = useForwardProps(props)
</script>

<template>
  <ContextMenuTrigger v-bind="forwardedProps">
    <slot />
  </ContextMenuTrigger>
</template>
