<script setup lang="ts">
import { ComboboxRoot } from 'reka-ui'
import { provide } from 'vue'

import { RemoteComboKey } from './state'
import type { RemoteComboContext } from './state'

const props = defineProps<{
  context: RemoteComboContext
  multiple?: boolean
  disabled?: boolean
}>()

const ctx = props.context
provide(RemoteComboKey, ctx)

function onOpenChange(value: boolean) {
  ctx.isOpen.value = value
}

function onSearchChange(value: string) {
  ctx.searchQuery.value = value
}
</script>

<template>
  <ComboboxRoot
    :open="ctx.isOpen.value"
    :search-term="ctx.searchQuery.value"
    :multiple="multiple"
    :disabled="disabled"
    ignore-filter
    :reset-search-term-on-select="false"
    data-testid="remote-combo-root"
    @update:open="onOpenChange"
    @update:search-term="onSearchChange"
  >
    <slot />
  </ComboboxRoot>
</template>
