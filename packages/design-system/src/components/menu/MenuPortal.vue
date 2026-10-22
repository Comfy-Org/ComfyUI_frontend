<script setup lang="ts">
import type { DropdownMenuPortalProps } from 'reka-ui'
import { DropdownMenuPortal, injectDropdownMenuRootContext } from 'reka-ui'
import { computed } from 'vue'

const { open = undefined, ...portalProps } = defineProps<
  DropdownMenuPortalProps & { open?: boolean }
>()

const rootContext = injectDropdownMenuRootContext()
const isOpen = computed(() => open ?? rootContext.open.value)
</script>

<template>
  <DropdownMenuPortal :key="Number(isOpen)" v-bind="portalProps">
    <slot />
  </DropdownMenuPortal>
</template>
