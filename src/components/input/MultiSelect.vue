<template>
  <div class="relative inline-block">
    <MultiSelect
      v-model="selectedItems"
      :options="filteredOptions"
      option-label="name"
      unstyled
      :placeholder="label"
      :max-selected-labels="0"
      :pt="pt"
    >
      <template
        v-if="hasSearchBox || showSelectedCount || hasClearButton"
        #header
      >
        <div class="p-2 flex flex-col gap-y-4 pb-0">
          <SearchBox
            v-if="hasSearchBox"
            v-model="searchQuery"
            :has-border="true"
            :place-holder="searchPlaceholder"
          />
          <div class="flex items-center justify-between">
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
              v-if="hasClearButton"
              :label="$t('g.clearAll')"
              type="transparent"
              size="fit-content"
              class="text-sm !text-blue-500 !dark-theme:text-blue-600"
              @click.stop="selectedItems = []"
            />
          </div>
          <div class="h-px bg-zinc-200 dark-theme:bg-zinc-700"></div>
        </div>
      </template>

      <!-- Trigger value (keep text scale identical) -->
      <template #value>
        <span class="text-sm text-zinc-700 dark-theme:text-gray-200">
          {{ label }}
        </span>
      </template>

      <!-- Chevron size identical to current -->
      <template #dropdownicon>
        <i-lucide:chevron-down class="text-lg text-neutral-400" />
      </template>

      <!-- Custom option row: square checkbox + label (unchanged layout/colors) -->
      <template #option="slotProps">
        <div class="flex items-center gap-2">
          <div
            class="flex h-4 w-4 p-0.5 flex-shrink-0 items-center justify-center rounded border-[3px] transition-all duration-200"
            :class="
              slotProps.selected
                ? 'border-blue-400 bg-blue-400 dark-theme:border-blue-500 dark-theme:bg-blue-500'
                : 'border-neutral-300 dark-theme:border-zinc-600 bg-neutral-100 dark-theme:bg-zinc-700'
            "
          >
            <i-lucide:check
              v-if="slotProps.selected"
              class="text-xs text-bold text-white"
            />
          </div>
          <span class="truncate" :title="slotProps.option.name">{{
            slotProps.option.name
          }}</span>
        </div>
      </template>
    </MultiSelect>

    <!-- Selected count badge -->
    <div
      v-if="selectedCount > 0"
      class="pointer-events-none absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 dark-theme:bg-blue-500 text-xs font-semibold text-white"
    >
      {{ selectedCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'
import MultiSelect, {
  MultiSelectPassThroughMethodOptions
} from 'primevue/multiselect'
import { computed } from 'vue'

import SearchBox from '@/components/input/SearchBox.vue'

import TextButton from '../button/TextButton.vue'

type Option = { name: string; value: string }

interface Props {
  /** Input label shown on the trigger button */
  label?: string
  /** Static options for the multiselect (when not using async search) */
  options: Option[]
  /** Show search box in the panel header */
  hasSearchBox?: boolean
  /** Show selected count text in the panel header */
  showSelectedCount?: boolean
  /** Show "Clear all" action in the panel header */
  hasClearButton?: boolean
  /** Placeholder for the search input */
  searchPlaceholder?: string
}
const {
  label,
  options,
  hasSearchBox = false,
  showSelectedCount = false,
  hasClearButton = false,
  searchPlaceholder = 'Search...'
} = defineProps<Props>()

const selectedItems = defineModel<Option[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery')
const selectedCount = computed(() => selectedItems.value.length)

// Fuse.js configuration for fuzzy search
const fuseOptions = {
  keys: ['name', 'value'],
  threshold: 0.3,
  includeScore: true
}

// Create Fuse instance
const fuse = computed(() => new Fuse(options, fuseOptions))

// Filtered options based on search
const filteredOptions = computed(() => {
  if (!hasSearchBox || !searchQuery.value?.trim()) {
    return options
  }

  const searchResults = fuse.value.search(searchQuery.value)
  const matchingOptions = searchResults.map((result) => result.item)

  // Always include selected items, even if they don't match the search
  const selectedValues = selectedItems.value.map((item) => item.value)
  const selectedOptionsNotInResults = options.filter(
    (option) =>
      selectedValues.includes(option.value) &&
      !matchingOptions.some((matching) => matching.value === option.value)
  )

  return [...selectedOptionsNotInResults, ...matchingOptions]
})

const pt = computed(() => ({
  root: ({ props }: MultiSelectPassThroughMethodOptions) => ({
    class: [
      'relative inline-flex cursor-pointer select-none w-full',
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
      hasSearchBox || showSelectedCount || hasClearButton ? 'block' : 'hidden'
  }),
  // Overlay & list visuals unchanged
  overlay:
    'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg border border-solid border-zinc-100 dark-theme:border-zinc-700 shadow-lg max-h-64 overflow-hidden',
  list: {
    class:
      'flex flex-col gap-1 p-0 list-none border-none text-xs max-h-52 overflow-y-auto'
  },
  // Option row hover tone identical
  option:
    'flex gap-1 items-center p-2 hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50',
  // Hide built-in checkboxes entirely via PT (no :deep)
  pcHeaderCheckbox: {
    root: { class: 'hidden' },
    style: 'display: none !important'
  },
  pcOptionCheckbox: {
    root: { class: 'hidden' },
    style: 'display: none !important'
  }
}))
</script>
