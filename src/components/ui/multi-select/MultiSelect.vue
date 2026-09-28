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
      :fallback-label="t('g.multiSelectDropdown')"
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
      :show-selected-count
      :show-clear-button
      :actions-placement
      :search-placeholder
      :list-max-height
      :popover-style
      :content-style
      :lifted-content-style
      @escape="isOpen = false"
    />
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { ComboboxRoot } from 'reka-ui'
import { ref } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'

import MultiSelectContent from '@/components/ui/multi-select/MultiSelectContent.vue'
import MultiSelectTrigger from '@/components/ui/multi-select/MultiSelectTrigger.vue'

import type { SelectOption } from '@/components/ui/select/types'
import { useAttrsClass } from '@/composables/useAttrsClass'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { usePopoverSizing } from '@/composables/usePopoverSizing'

defineOptions({
  inheritAttrs: false
})

const { attrsClass, attrsWithoutClass } = useAttrsClass()

const {
  label,
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
} = defineProps<{
  /** Input label shown on the trigger button */
  label?: string
  /** Available options */
  options?: SelectOption[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Disable the select */
  disabled?: boolean
  /** Show search box in the panel header */
  showSearchBox?: boolean
  /** Show selected count text in the panel header */
  showSelectedCount?: boolean
  /** Show "Clear all" action in the panel header */
  showClearButton?: boolean
  actionsPlacement?: 'header' | 'footer'
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}>()

const selectedItems = defineModel<SelectOption[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const { t } = useI18n()
const isOpen = ref(false)
const liftedContentStyle = useModalLiftedZIndex(isOpen)

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
</script>
