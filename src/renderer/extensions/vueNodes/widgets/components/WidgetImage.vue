<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <Image v-bind="filteredProps" :src="widget.value" />
  </div>
</template>

<script setup lang="ts">
import Image from 'primevue/image'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  IMAGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

// Image widgets typically don't have v-model, they display a source URL/path
const props = defineProps<{
  widget: SimplifiedWidget<string>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, IMAGE_EXCLUDED_PROPS)
)
</script>
