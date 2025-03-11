<template>
  <div>
    <MultiSelect
      v-model="selectedItems"
      :options="options"
      filter
      :placeholder="placeholder"
      :maxSelectedLabels="3"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import { computed, defineModel } from 'vue'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

const selectedItems = defineModel<string[]>({ required: true })
const { widget } = defineProps<{
  widget: ComponentWidget<string[]>
}>()
const options = computed(
  () => (widget.inputSpec as ComboInputSpec).options ?? []
)
const placeholder = computed(
  () => (widget.inputSpec as ComboInputSpec).placeholder ?? 'Select items'
)
</script>
