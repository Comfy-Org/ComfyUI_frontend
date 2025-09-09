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
    v-bind="$attrs"
    option-label="name"
    unstyled
    :max-selected-labels="0"
    :pt="pt"
  >
    <template
      v-if="showSearchBox || showSelectedCount || showClearButton"
      #header
    >
      <div class="pt-2 pb-0 px-2 flex flex-col">
        <SearchBox
          v-if="showSearchBox"
          v-model="searchQuery"
          :class="showSelectedCount || showClearButton ? 'mb-2' : ''"
          :show-order="true"
          :show-border="true"
          :place-holder="searchPlaceholder"
        />
        <div
          v-if="showSelectedCount || showClearButton"
          class="mt-2 flex items-center justify-between"
        >
          <span
            v-if="showSelectedCount"
            class="text-sm text-neutral-400 dark-theme:text-zinc-500 px-1"
          >
            {{
              selectedCount > 0
                ? $t('g.itemsSelected', { selectedCount })
                : $t('g.itemSelected', { selectedCount })
            }}
          </span>
          <TextButton
            v-if="showClearButton"
            :label="$t('g.clearAll')"
            type="transparent"
            size="fit-content"
            class="text-sm text-blue-500 dark-theme:text-blue-600"
            @click.stop="selectedItems = []"
          />
        </div>
        <div class="my-4 h-px bg-zinc-200 dark-theme:bg-zinc-700"></div>
      </div>
    </template>

    <!-- Trigger value (keep text scale identical) -->
    <template #value>
      <span class="text-sm text-zinc-700 dark-theme:text-gray-200">
        {{ label }}
      </span>
      <span
        v-if="selectedCount > 0"
        class="pointer-events-none absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 dark-theme:bg-blue-500 text-xs font-semibold text-white"
      >
        {{ selectedCount }}
      </span>
    </template>

    <!-- Chevron size identical to current -->
    <template #dropdownicon>
      <i-lucide:chevron-down class="text-lg text-neutral-400" />
    </template>

    <!-- Custom option row: square checkbox + label (unchanged layout/colors) -->
    <template #option="slotProps">
      <div class="flex items-center gap-2" :style="popoverStyle">
        <div
          class="flex h-4 w-4 p-0.5 shrink-0 items-center justify-center rounded transition-all duration-200"
          :class="
            slotProps.selected
              ? 'bg-blue-400 dark-theme:border-blue-500 dark-theme:bg-blue-500'
              : 'bg-neutral-100 dark-theme:bg-zinc-700'
          "
        >
          <i-lucide:check
            v-if="slotProps.selected"
            class="text-xs text-bold text-white"
          />
        </div>
        <Button
          class="border-none outline-none bg-transparent text-left"
          unstyled
          >{{ slotProps.option.name }}</Button
        >
      </div>
    </template>
  </MultiSelect>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import MultiSelect, {
  MultiSelectPassThroughMethodOptions
} from 'primevue/multiselect'
import { computed } from 'vue'

import SearchBox from '@/components/input/SearchBox.vue'
import { usePopoverSizing } from '@/composables/usePopoverSizing'

import TextButton from '../button/TextButton.vue'

type Option = { name: string; value: string }

defineOptions({
  inheritAttrs: false
})

interface Props {
  /** Input label shown on the trigger button */
  label?: string
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
const searchQuery = defineModel<string>('searchQuery')
const selectedCount = computed(() => selectedItems.value.length)

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})

const pt = computed(() => ({
  root: ({ props }: MultiSelectPassThroughMethodOptions) => ({
    class: [
      'h-10 relative inline-flex cursor-pointer select-none',
      'rounded-lg bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white',
      'transition-all duration-200 ease-in-out',
      'border-[2.5px] border-solid',
      selectedCount.value > 0
        ? 'border-blue-400 dark-theme:border-blue-500'
        : 'border-transparent',
      { 'opacity-60 cursor-default': props.disabled }
    ]
  }),
  labelContainer: {
    class:
      'flex-1 flex items-center overflow-hidden whitespace-nowrap pl-4 py-2 '
  },
  label: {
    class: 'p-0'
  },
  dropdown: {
    class: 'flex shrink-0 cursor-pointer items-center justify-center px-3'
  },
  header: () => ({
    class:
      showSearchBox || showSelectedCount || showClearButton ? 'block' : 'hidden'
  }),
  // Overlay & list visuals unchanged
  overlay: {
    class: [
      'mt-2 rounded-lg py-2 px-2',
      'bg-white dark-theme:bg-zinc-800',
      'text-neutral dark-theme:text-white',
      'border border-solid border-neutral-200 dark-theme:border-zinc-700'
    ]
  },
  listContainer: () => ({
    style: { maxHeight: listMaxHeight },
    class: 'overflow-y-auto scrollbar-hide'
  }),
  list: {
    class: 'flex flex-col gap-0 p-0 m-0 list-none border-none text-sm'
  },
  // Option row hover and focus tone
  option: ({ context }: MultiSelectPassThroughMethodOptions) => ({
    class: [
      'flex gap-2 items-center h-10 px-2 rounded-lg',
      'hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50',
      // Add focus/highlight state for keyboard navigation
      {
        'bg-neutral-100/50 dark-theme:bg-zinc-700/50': context?.focused
      }
    ]
  }),
  // Hide built-in checkboxes entirely via PT (no :deep)
  pcHeaderCheckbox: {
    root: { class: 'hidden' },
    style: { display: 'none' }
  },
  pcOptionCheckbox: {
    root: { class: 'hidden' },
    style: { display: 'none' }
  }
}))
</script>
