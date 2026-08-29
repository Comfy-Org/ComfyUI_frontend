<template>
  <div>
    <MultiSelect
      v-model="selectedOptions"
      :options="options"
      show-search-box
      :label="placeholder"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import type { SelectOption } from '@/components/ui/select/types'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

const selectedItems = defineModel<string[]>({ required: true })
const { widget } = defineProps<{
  widget: ComponentWidget<string[]>
}>()

const inputSpec = widget.inputSpec as ComboInputSpec
const options = computed<SelectOption[]>(() =>
  (inputSpec.options ?? []).map((value) => ({
    name: String(value),
    value: String(value)
  }))
)
const selectedOptions = computed({
  get: () =>
    options.value.filter(({ value }) =>
      selectedItems.value.includes(String(value))
    ),
  set: (value: SelectOption[]) => {
    selectedItems.value = value.map(({ value }) => String(value))
  }
})
const placeholder = inputSpec.multi_select?.placeholder ?? 'Select items'
</script>
