<script setup lang="ts">
import type { DropdownMenuGroupProps } from 'reka-ui'
import { DropdownMenuGroup, useForwardProps } from 'reka-ui'

const props = defineProps<DropdownMenuGroupProps>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DropdownMenuGroup v-bind="forwarded">
    <slot />
  </DropdownMenuGroup>
</template>
