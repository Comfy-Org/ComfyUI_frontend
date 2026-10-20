<template>
  <div>
    <MultiSelect
      v-model="selectedOptions"
      :search-label="$t('g.search')"
      :search-placeholder="$t('g.search')"
      :empty-text="$t('g.noResultsFound')"
      :accessible-label="placeholder || $t('g.multiSelectDropdown')"
      :clear-all-label="$t('g.clearAll')"
      :format-selected-count="(count) => $t('g.itemsSelected', { count })"
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
            :remove-label="$t('g.remove')"
            variant="square"
            severity="secondary"
            class="min-w-0 shrink"
          >
            <span class="truncate">{{ item.name }}</span>
          </Badge>
        </div>
      </template>
    </MultiSelect>
  </div>
</template>

<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import { computed } from 'vue'

import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
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
