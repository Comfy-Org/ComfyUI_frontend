<script setup lang="ts">
import { HoverCardRoot, useForwardPropsEmits } from 'reka-ui'
import type { HoverCardRootEmits, HoverCardRootProps } from 'reka-ui'
import { provide, ref } from 'vue'

import { hoverCardOpenKey } from './hoverCardContext'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardPropsEmits
const props = defineProps<HoverCardRootProps>()
const emits = defineEmits<HoverCardRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)

const isOpen = ref(false)
provide(hoverCardOpenKey, isOpen)
</script>

<template>
  <HoverCardRoot v-bind="forwarded" v-model:open="isOpen">
    <slot />
  </HoverCardRoot>
</template>
