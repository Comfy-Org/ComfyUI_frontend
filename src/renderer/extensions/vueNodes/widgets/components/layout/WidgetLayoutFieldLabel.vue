<script setup lang="ts">
import { computed } from 'vue'

import { useHideLayoutField } from '@/types/widgetTypes'

const { widget, displayLabel, inputId } = defineProps<{
  widget: { name: string; label?: string; displayLabel?: string }
  displayLabel?: string
  inputId?: string
}>()

const hideLayoutField = useHideLayoutField()
const label = computed(() =>
  widget.name
    ? (displayLabel ?? widget.displayLabel ?? (widget.label || widget.name))
    : ''
)
</script>

<template>
  <label
    v-if="!hideLayoutField"
    :for="inputId"
    :title="label"
    class="max-w-fit min-w-0 flex-1 cursor-[inherit] content-center-safe truncate text-node-foreground select-none"
  >
    <span data-testid="widget-layout-field-label" class="block truncate">
      {{ label }}
    </span>
  </label>
</template>
