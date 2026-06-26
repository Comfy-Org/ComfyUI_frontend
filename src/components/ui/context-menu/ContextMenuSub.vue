<script setup lang="ts">
import type { ContextMenuSubEmits, ContextMenuSubProps } from 'reka-ui'
import { ContextMenuSub, useForwardPropsEmits } from 'reka-ui'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardPropsEmits
const props = defineProps<ContextMenuSubProps>()
const emits = defineEmits<ContextMenuSubEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <ContextMenuSub v-bind="forwarded">
    <slot />
  </ContextMenuSub>
</template>
