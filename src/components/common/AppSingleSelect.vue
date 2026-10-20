<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import type { SingleSelectProps } from '@/components/ui/single-select/types'

type TranslatedProps = 'accessibleLabel' | 'searchLabel' | 'emptyText'

const {
  label,
  accessibleLabel,
  searchLabel,
  searchPlaceholder,
  emptyText,
  ...restProps
} = defineProps<
  Omit<SingleSelectProps, TranslatedProps> &
    Partial<Pick<SingleSelectProps, TranslatedProps>>
>()

const selectedItem = defineModel<string | number | undefined>({
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
