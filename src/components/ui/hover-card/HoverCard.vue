<script setup lang="ts">
import { HoverCardRoot, useForwardProps } from 'reka-ui'
import type { HoverCardRootEmits, HoverCardRootProps } from 'reka-ui'
import { provide, ref, watch } from 'vue'

import { hoverCardOpenKey } from './hoverCardContext'

// eslint-disable-next-line vue/no-unused-properties -- forwarded to Reka via useForwardProps
const props = defineProps<HoverCardRootProps>()
const emits = defineEmits<HoverCardRootEmits>()

const forwarded = useForwardProps(props)

const isOpen = ref(forwarded.value.open ?? props.defaultOpen ?? false)
provide(hoverCardOpenKey, isOpen)

watch(
  () => forwarded.value.open,
  (open) => {
    if (open !== undefined) isOpen.value = open
  }
)

function handleOpenUpdate(open: boolean) {
  if (forwarded.value.open === undefined) isOpen.value = open
  emits('update:open', open)
}
</script>

<template>
  <HoverCardRoot v-bind="forwarded" @update:open="handleOpenUpdate">
    <slot />
  </HoverCardRoot>
</template>
