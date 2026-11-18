<script setup lang="ts">
import { HoverCardRoot, useForwardPropsEmits } from 'reka-ui'
import type { HoverCardRootEmits, HoverCardRootProps } from 'reka-ui'

const props = defineProps<HoverCardRootProps>()
const emits = defineEmits<HoverCardRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <HoverCardRoot v-bind="forwarded">
    <slot />
  </HoverCardRoot>
</template>
