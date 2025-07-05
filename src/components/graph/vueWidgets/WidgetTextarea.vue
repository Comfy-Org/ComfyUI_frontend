<template>
  <Textarea
    v-model="value"
    v-bind="filteredProps"
    :disabled="readonly"
    class="w-full"
    rows="3"
  />
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
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
