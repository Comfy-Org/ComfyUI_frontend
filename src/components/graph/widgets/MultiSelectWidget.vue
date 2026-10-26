<template>
  <div>
    <AppMultiSelect
      v-model="selectedOptions"
      :options="options"
      show-search-box
      :label="placeholder"
      class="w-full"
    >
      <template v-if="inputSpec.multi_select?.chip" #value="{ selected }">
        <div class="flex min-w-0 gap-1 overflow-hidden">
          <Badge
            v-for="item in selected"
            :key="item.value"
            variant="square"
            severity="secondary"
            class="min-w-0 shrink"
          >
            <span class="truncate">{{ item.name }}</span>
          </Badge>
        </div>
      </template>
    </AppMultiSelect>
  </div>
</template>

<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import { computed } from 'vue'

import AppMultiSelect from '@/components/common/AppMultiSelect.vue'
import type { SelectOption } from '@/components/ui/select/types'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/types/domWidget'

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
