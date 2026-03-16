<template>
  <!--
    Note: Unlike SingleSelect, we don't need an explicit options prop because:
    1. Our value template only shows a static label (not dynamic based on selection)
    2. We display a count badge instead of actual selected labels
    3. All PrimeVue props (including options) are passed via v-bind="$attrs"
    option-label="name" is required because our option template directly accesses option.name
    max-selected-labels="0" is required to show count badge instead of selected item labels
  -->
  <MultiSelect
    v-model="selectedItems"
    v-bind="{ ...$attrs, options: filteredOptions }"
    option-label="name"
    unstyled
    :max-selected-labels="0"
    :pt="{
      root: ({ props }: MultiSelectPassThroughMethodOptions) => ({
        class: cn(
          'relative inline-flex cursor-pointer select-none',
          size === 'md' ? 'h-8' : 'h-10',
          'rounded-lg bg-secondary-background text-base-foreground',
          'transition-all duration-200 ease-in-out',
          'hover:bg-secondary-background-hover',
          'border-[2.5px] border-solid',
          selectedCount > 0 ? 'border-base-foreground' : 'border-transparent',
          'focus-within:border-base-foreground',
          props.disabled &&
            'cursor-default opacity-30 hover:bg-secondary-background'
        )
      }),
      labelContainer: {
        class: cn(
          'flex flex-1 items-center overflow-hidden py-2 whitespace-nowrap',
          size === 'md' ? 'pl-3' : 'pl-4'
        )
      },
      label: {
        class: 'p-0'
      },
      dropdown: {
        class: 'flex shrink-0 cursor-pointer items-center justify-center px-3'
      },
      header: () => ({
        class:
          showSearchBox || showSelectedCount || showClearButton
            ? 'block'
            : 'hidden'
      }),
      // Overlay & list visuals unchanged
      overlay: {
        class: cn(
          'mt-2 rounded-lg p-2',
          'bg-base-background',
          'text-base-foreground',
          'border border-solid border-border-default'
        )
      },
      listContainer: () => ({
        style: { maxHeight: `min(${listMaxHeight}, 50vh)` },
        class: 'scrollbar-custom'
      }),
      list: {
        class: 'flex flex-col gap-0 p-0 m-0 list-none border-none text-sm'
      },
      // Option row hover and focus tone
      option: ({ context }: MultiSelectPassThroughMethodOptions) => ({
        class: cn(
          'flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2',
          'hover:bg-secondary-background-hover',
          // Add focus/highlight state for keyboard navigation
          context?.focused &&
            'bg-secondary-background-selected hover:bg-secondary-background-selected'
        )
      }),
      // Hide built-in checkboxes entirely via PT (no :deep)
      pcHeaderCheckbox: {
        root: { class: 'hidden' },
        style: { display: 'none' }
      },
      pcOptionCheckbox: {
        root: { class: 'hidden' },
        style: { display: 'none' }
      },
      emptyMessage: {
        class: 'px-3 pb-4 text-sm text-muted-foreground'
      }
    }"
    :aria-label="label || t('g.multiSelectDropdown')"
    role="combobox"
    :aria-expanded="false"
    aria-haspopup="listbox"
    :tabindex="0"
  >
    <template
      v-if="showSearchBox || showSelectedCount || showClearButton"
      #header
    >
      <div class="flex flex-col px-2 pt-2 pb-0">
        <SearchInput
          v-if="showSearchBox"
          v-model="searchQuery"
          :class="showSelectedCount || showClearButton ? 'mb-2' : ''"
          :placeholder="searchPlaceholder"
          size="sm"
        />
        <div
          v-if="showSelectedCount || showClearButton"
          class="mt-2 flex items-center justify-between"
        >
          <span
            v-if="showSelectedCount"
            class="px-1 text-sm text-base-foreground"
          >
            {{
              selectedCount > 0
                ? $t('g.itemsSelected', { selectedCount })
                : $t('g.itemSelected', { selectedCount })
            }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ $t('g.clearAll') }}
          </Button>
        </div>
        <div class="my-4 h-px bg-border-default"></div>
      </div>
    </template>

    <!-- Trigger value (keep text scale identical) -->
    <template #value>
      <span :class="size === 'md' ? 'text-xs' : 'text-sm'">
        {{ label }}
      </span>
      <span
        v-if="selectedCount > 0"
        class="pointer-events-none absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-base-foreground text-xs font-semibold text-base-background"
      >
        {{ selectedCount }}
      </span>
    </template>

    <!-- Chevron size identical to current -->
    <template #dropdownicon>
      <i class="icon-[lucide--chevron-down] text-muted-foreground" />
    </template>

    <!-- Custom option row: square checkbox + label (unchanged layout/colors) -->
    <template #option="slotProps">
      <div
        role="button"
        class="flex cursor-pointer items-center gap-2"
        :style="popoverStyle"
      >
        <div
          class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
          :class="
            slotProps.selected
              ? 'bg-primary-background'
              : 'bg-secondary-background'
          "
        >
          <i
            v-if="slotProps.selected"
            class="text-bold icon-[lucide--check] text-xs text-base-foreground"
          />
        </div>
        <span>
          {{ slotProps.option.name }}
        </span>
      </div>
    </template>
  </MultiSelect>
</template>

<script setup lang="ts">
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import type { MultiSelectPassThroughMethodOptions } from 'primevue/multiselect'
import MultiSelect from 'primevue/multiselect'
import { computed, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePopoverSizing } from '@/composables/usePopoverSizing'
import { cn } from '@/utils/tailwindUtil'

import type { SelectOption } from './types'

type Option = SelectOption

defineOptions({
  inheritAttrs: false
})

interface Props {
  /** Input label shown on the trigger button */
  label?: string
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show search box in the panel header */
  showSearchBox?: boolean
  /** Show selected count text in the panel header */
  showSelectedCount?: boolean
  /** Show "Clear all" action in the panel header */
  showClearButton?: boolean
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
  // Note: options prop is intentionally omitted.
  // It's passed via $attrs to maximize PrimeVue API compatibility
}
const {
  label,
  size = 'lg',
  showSearchBox = false,
  showSelectedCount = false,
  showClearButton = false,
  searchPlaceholder = 'Search...',
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<Props>()

const selectedItems = defineModel<Option[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const { t } = useI18n()
const selectedCount = computed(() => selectedItems.value.length)

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
const attrs = useAttrs()
const originalOptions = computed(() => (attrs.options as Option[]) || [])

// Use VueUse's useFuse for better reactivity and performance
const fuseOptions: UseFuseOptions<Option> = {
  fuseOptions: {
    keys: ['name', 'value'],
    threshold: 0.3,
    includeScore: false
  },
  matchAllWhenSearchEmpty: true
}

const { results } = useFuse(searchQuery, originalOptions, fuseOptions)

// Filter options based on search, but always include selected items
const filteredOptions = computed(() => {
  if (!searchQuery.value || searchQuery.value.trim() === '') {
    return originalOptions.value
  }

  // results.value already contains the search results from useFuse
  const searchResults = results.value.map(
    (result: { item: Option }) => result.item
  )

  // Include selected items that aren't in search results
  const selectedButNotInResults = selectedItems.value.filter(
    (item) =>
      !searchResults.some((result: Option) => result.value === item.value)
  )

  return [...selectedButNotInResults, ...searchResults]
})
</script>
