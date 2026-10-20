<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'

type PrimitiveProps = ComponentProps<typeof MultiSelect>

const {
  label,
  accessibleLabel,
  searchLabel,
  searchPlaceholder,
  emptyText,
  clearAllLabel,
  formatSelectedCount,
  ...restProps
} = defineProps<{
  label?: PrimitiveProps['label']
  accessibleLabel?: PrimitiveProps['accessibleLabel']
  searchLabel?: PrimitiveProps['searchLabel']
  searchPlaceholder?: PrimitiveProps['searchPlaceholder']
  emptyText?: PrimitiveProps['emptyText']
  clearAllLabel?: PrimitiveProps['clearAllLabel']
  formatSelectedCount?: PrimitiveProps['formatSelectedCount']
  options?: PrimitiveProps['options']
  size?: PrimitiveProps['size']
  disabled?: PrimitiveProps['disabled']
  showSearchBox?: PrimitiveProps['showSearchBox']
  showSelectedCount?: PrimitiveProps['showSelectedCount']
  showClearButton?: PrimitiveProps['showClearButton']
  actionsPlacement?: PrimitiveProps['actionsPlacement']
  listMaxHeight?: PrimitiveProps['listMaxHeight']
  popoverMinWidth?: PrimitiveProps['popoverMinWidth']
  popoverMaxWidth?: PrimitiveProps['popoverMaxWidth']
  contentStyle?: PrimitiveProps['contentStyle']
}>()

const selectedItems = defineModel<PrimitiveProps['modelValue']>({
  required: true
})
const searchQuery = defineModel<PrimitiveProps['searchQuery']>('searchQuery', {
  default: ''
})
const { t } = useI18n()
</script>

<template>
  <MultiSelect
    v-bind="restProps"
    v-model="selectedItems"
    v-model:search-query="searchQuery"
    :label
    :accessible-label="accessibleLabel ?? (label || t('g.multiSelectDropdown'))"
    :search-label="searchLabel ?? t('g.search')"
    :search-placeholder="searchPlaceholder ?? t('g.search')"
    :empty-text="emptyText ?? t('g.noResultsFound')"
    :clear-all-label="clearAllLabel ?? t('g.clearAll')"
    :format-selected-count="
      formatSelectedCount ?? ((count) => t('g.itemsSelected', { count }))
    "
  >
    <template v-if="$slots.value" #value="{ selected }">
      <slot name="value" :selected />
    </template>
  </MultiSelect>
</template>
