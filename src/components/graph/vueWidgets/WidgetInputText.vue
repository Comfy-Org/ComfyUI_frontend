<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <InputText v-model="value" v-bind="filteredProps" :disabled="readonly" />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<string>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<string>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
)
</script>
