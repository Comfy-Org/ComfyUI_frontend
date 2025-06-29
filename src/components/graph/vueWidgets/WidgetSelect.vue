<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <Select v-model="value" v-bind="filteredProps" :disabled="readonly" />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<any>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<any>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS)
)
</script>
