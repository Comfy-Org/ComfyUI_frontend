<script setup lang="ts">
import { computed } from 'vue'

import {
  widgetLabel,
  widgetName
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { useHideLayoutField } from '@/types/widgetTypes'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const { widgetId, displayLabel, inputId } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
  inputId?: string
}>()

const hideLayoutField = useHideLayoutField()
const label = computed(
  () => displayLabel ?? (widgetLabel(widgetId) || widgetName(widgetId))
)
</script>

<template>
  <label
    v-if="!hideLayoutField"
    :for="inputId"
    :title="label"
    class="max-w-fit min-w-0 flex-1 cursor-[inherit] content-center-safe truncate text-node-foreground select-none"
    data-part="widget-label"
    data-testid="widget-layout-field-label"
  >
    {{ label }}
  </label>
</template>
