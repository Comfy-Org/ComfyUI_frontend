<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'

type PrimitiveProps = ComponentProps<typeof SingleSelect>

const {
  label,
  accessibleLabel,
  searchLabel,
  searchPlaceholder,
  emptyText,
  ...restProps
} = defineProps<{
  label?: PrimitiveProps['label']
  accessibleLabel?: PrimitiveProps['accessibleLabel']
  searchLabel?: PrimitiveProps['searchLabel']
  searchPlaceholder?: PrimitiveProps['searchPlaceholder']
  emptyText?: PrimitiveProps['emptyText']
  options?: PrimitiveProps['options']
  size?: PrimitiveProps['size']
  invalid?: PrimitiveProps['invalid']
  loading?: PrimitiveProps['loading']
  disabled?: PrimitiveProps['disabled']
  searchable?: PrimitiveProps['searchable']
  listMaxHeight?: PrimitiveProps['listMaxHeight']
  popoverMinWidth?: PrimitiveProps['popoverMinWidth']
  popoverMaxWidth?: PrimitiveProps['popoverMaxWidth']
  contentStyle?: PrimitiveProps['contentStyle']
}>()

const selectedItem = defineModel<PrimitiveProps['modelValue']>({
  required: true
})
const { t } = useI18n()
</script>

<template>
  <SingleSelect
    v-bind="restProps"
    v-model="selectedItem"
    :label
    :accessible-label="
      accessibleLabel ?? (label || t('g.singleSelectDropdown'))
    "
    :search-label="searchLabel ?? t('g.search')"
    :search-placeholder="searchPlaceholder ?? t('g.search')"
    :empty-text="emptyText ?? t('g.noResultsFound')"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
  </SingleSelect>
</template>
