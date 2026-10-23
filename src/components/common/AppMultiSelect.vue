<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import type { MultiSelectProps } from '@/components/ui/multi-select/types'
import type { SelectOption } from '@/components/ui/select/types'

type TranslatedProps =
  | 'accessibleLabel'
  | 'searchLabel'
  | 'emptyText'
  | 'clearAllLabel'
  | 'formatSelectedCount'

const {
  label,
  accessibleLabel,
  searchLabel,
  searchPlaceholder,
  emptyText,
  clearAllLabel,
  formatSelectedCount,
  ...restProps
} = defineProps<
  Omit<MultiSelectProps, TranslatedProps> &
    Partial<Pick<MultiSelectProps, TranslatedProps>>
>()

const selectedItems = defineModel<SelectOption[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', {
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
