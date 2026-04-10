<script setup lang="ts">
import { computedAsync, refDebounced } from '@vueuse/core'
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/platform/updates/common/toastStore'

import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
import { defaultSearcher, getDefaultSortOptions } from './shared'
import type { FormDropdownItem, LayoutMode, SortOption } from './types'

interface Props {
  items: FormDropdownItem[]
  /** Items used for display in the input field. Falls back to items if not provided. */
  displayItems?: FormDropdownItem[]
  placeholder?: string
  /**
   * If true, allows multiple selections. If a number is provided,
   * it specifies the maximum number of selections allowed.
   */
  multiple?: boolean | number

  uploadable?: boolean
  disabled?: boolean
  accept?: string
  filterOptions?: FilterOption[]
  sortOptions?: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  isSelected?: (
    selected: Set<string>,
    item: FormDropdownItem,
    index: number
  ) => boolean
  searcher?: (
    query: string,
    items: FormDropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<FormDropdownItem[]>
}

const { t } = useI18n()

const {
  placeholder,
  multiple = false,
  uploadable = false,
  disabled = false,
  accept,
  filterOptions = [],
  sortOptions = getDefaultSortOptions(),
  showOwnershipFilter,
  ownershipOptions,
  showBaseModelFilter,
  baseModelOptions,
  isSelected = (selected, item, _index) => selected.has(item.id),
  searcher = defaultSearcher,
  items
} = defineProps<Props>()

const placeholderText = computed(
  () => placeholder ?? t('widgets.uploadSelect.placeholder')
)

const selected = defineModel<Set<string>>('selected', {
  default: () => new Set()
})
const filterSelected = defineModel<string>('filterSelected', { default: '' })
const sortSelected = defineModel<string>('sortSelected', {
  default: 'default'
})
const layoutMode = defineModel<LayoutMode>('layoutMode', {
  default: 'grid'
})
const files = defineModel<File[]>('files', { default: () => [] })
const searchQuery = defineModel<string>('searchQuery', { default: '' })
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})
const baseModelSelected = defineModel<Set<string>>('baseModelSelected', {
  default: () => new Set()
})
const isOpen = defineModel<boolean>('isOpen', { default: false })

const toastStore = useToastStore()

const maxSelectable = computed(() => {
  if (multiple === true) return Infinity
  if (typeof multiple === 'number') return multiple
  return 1
})

const debouncedSearchQuery = refDebounced(searchQuery, 250, { maxWait: 1000 })

const filteredItems = computedAsync(async (onCancel) => {
  if (!isOpen.value) {
    return items
  }

  let cleanupFn: (() => void) | undefined
  onCancel(() => cleanupFn?.())
  const result = await searcher(debouncedSearchQuery.value, items, (cb) => {
    cleanupFn = cb
  })
  return result
}, items)

const defaultSorter = computed<SortOption['sorter']>(() => {
  const sorter = sortOptions.find((option) => option.id === 'default')?.sorter
  return sorter || (({ items: i }) => i.slice())
})
const selectedSorter = computed<SortOption['sorter']>(() => {
  if (sortSelected.value === 'default') return defaultSorter.value
  const sorter = sortOptions.find(
    (option) => option.id === sortSelected.value
  )?.sorter
  return sorter || defaultSorter.value
})
const sortedItems = computed(() => {
  if (!isOpen.value) {
    return items
  }

  return selectedSorter.value({ items: filteredItems.value }) || []
})

function internalIsSelected(item: FormDropdownItem, index: number): boolean {
  return isSelected(selected.value, item, index)
}

function toggleDropdown(event: Event) {
  if (disabled) return
  void event
  isOpen.value = !isOpen.value
}

function closeDropdown() {
  isOpen.value = false
}

function handleFileChange(event: Event) {
  if (disabled) return
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (target.files) {
    files.value = Array.from(target.files)
  }
  target.value = ''
}

function handleSelection(item: FormDropdownItem, index: number) {
  if (disabled) return
  const sel = selected.value
  if (internalIsSelected(item, index)) {
    sel.delete(item.id)
  } else {
    if (sel.size < maxSelectable.value) {
      sel.add(item.id)
    } else if (maxSelectable.value === 1) {
      sel.clear()
      sel.add(item.id)
    } else {
      toastStore.addAlert(t('widgets.uploadSelect.maxSelectionReached'))
      return
    }
  }
  selected.value = new Set(sel)

  if (maxSelectable.value === 1) {
    closeDropdown()
  }
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverAnchor as-child>
      <FormDropdownInput
        :files
        :is-open
        :placeholder="placeholderText"
        :items
        :display-items
        :max-selectable
        :selected
        :uploadable
        :disabled
        :accept
        @select-click="toggleDropdown"
        @file-change="handleFileChange"
      />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="8"
        :collision-padding="8"
        data-testid="form-dropdown-content"
        class="z-50"
        @escape-key-down="closeDropdown"
        @pointer-down-outside="closeDropdown"
        @focus-outside.prevent
      >
        <FormDropdownMenu
          v-model:filter-selected="filterSelected"
          v-model:layout-mode="layoutMode"
          v-model:sort-selected="sortSelected"
          v-model:search-query="searchQuery"
          v-model:ownership-selected="ownershipSelected"
          v-model:base-model-selected="baseModelSelected"
          :filter-options
          :sort-options
          :show-ownership-filter
          :ownership-options
          :show-base-model-filter
          :base-model-options
          :disabled
          :items="sortedItems"
          :is-selected="internalIsSelected"
          :max-selectable
          @close="closeDropdown"
          @item-click="handleSelection"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
