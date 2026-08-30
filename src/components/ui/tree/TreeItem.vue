<template>
  <RekaTreeItem
    v-slot="slotProps"
    :value
    :level
    as-child
    @toggle="preventPointerToggle"
  >
    <slot v-bind="slotProps" />
  </RekaTreeItem>
</template>

<script setup lang="ts" generic="T extends object">
import type { TreeItemToggleEvent } from 'reka-ui'
import { TreeItem as RekaTreeItem } from 'reka-ui'

const { value, level } = defineProps<{
  value: T
  level: number
}>()

function preventPointerToggle(event: TreeItemToggleEvent<T>) {
  if (event.detail.originalEvent instanceof PointerEvent) {
    event.preventDefault()
  }
}
</script>
