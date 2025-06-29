<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <ToggleSwitch v-model="value" v-bind="filteredProps" :disabled="readonly" />
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<boolean>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<boolean>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)
</script>
