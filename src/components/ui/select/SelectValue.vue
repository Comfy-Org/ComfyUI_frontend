<script setup lang="ts">
import type { SelectValueProps } from 'reka-ui'
import { SelectValue, useForwardProps } from 'reka-ui'

const { ...restProps } = defineProps<SelectValueProps>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <SelectValue v-bind="forwarded">
    <slot />
  </SelectValue>
</template>
