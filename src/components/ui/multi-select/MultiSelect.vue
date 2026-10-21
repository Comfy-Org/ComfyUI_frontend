<template>
  <ComboboxRoot
    v-model="selectedItems"
    v-model:open="isOpen"
    multiple
    by="value"
    :disabled
    ignore-filter
    :reset-search-term-on-select="false"
  >
    <MultiSelectTrigger
      v-bind="attrsWithoutClass"
      :class="attrsClass"
      :label
      :accessible-label
      :selected-items="selectedItems"
      :size
    >
      <template v-if="$slots.value" #default="{ selected }">
        <slot name="value" :selected />
      </template>
    </MultiSelectTrigger>

    <MultiSelectContent
      v-model="selectedItems"
      v-model:search-query="searchQuery"
      :options
      :show-search-box
      :show-clear-button
      :actions-placement
      :search-placeholder
      :search-label
      :empty-text
      :clear-all-label
      :format-selected-count="
        showSelectedCount ? formatSelectedCount : undefined
      "
      :list-max-height
      :popover-style
      :content-style
      @escape="isOpen = false"
    />
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { ComboboxRoot } from 'reka-ui'
import { ref } from 'vue'

import MultiSelectContent from '@/components/ui/multi-select/MultiSelectContent.vue'
import MultiSelectTrigger from '@/components/ui/multi-select/MultiSelectTrigger.vue'
import type { MultiSelectProps } from '@/components/ui/multi-select/types'

import type { SelectOption } from '@/components/ui/select/types'
import { useAttrsClass } from '@/composables/useAttrsClass'
import { usePopoverSizing } from '@/composables/usePopoverSizing'

defineOptions({
  inheritAttrs: false
})

const { attrsClass, attrsWithoutClass } = useAttrsClass()

const {
  label,
  accessibleLabel,
  searchLabel,
  emptyText,
  clearAllLabel,
  formatSelectedCount,
  options = [],
  size = 'lg',
  disabled = false,
  showSearchBox = false,
  showSelectedCount = false,
  showClearButton = false,
  actionsPlacement = 'header',
  searchPlaceholder,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth,
  contentStyle
} = defineProps<MultiSelectProps>()

const selectedItems = defineModel<SelectOption[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const isOpen = ref(false)

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
</script>
