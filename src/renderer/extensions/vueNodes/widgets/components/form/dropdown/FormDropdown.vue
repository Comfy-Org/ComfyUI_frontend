<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import Popover from 'primevue/popover'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
import type {
  DropdownItem,
  LayoutMode,
  SelectedKey,
  SortOptionLabel
} from './types'

interface Props {
  items: DropdownItem[]
  placeholder?: string
  /**
   * If true, allows multiple selections. If a number is provided,
   * it specifies the maximum number of selections allowed.
   */
  multiple?: boolean | number

  uploadable?: boolean
  isSelected?: (
    selected: Set<SelectedKey>,
    item: DropdownItem,
    index: number
  ) => boolean
  searcher?: (
    query: string,
    items: DropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<DropdownItem[]>
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  multiple: false,
  uploadable: false,
  isSelected: (selected, item, _index) => selected.has(item.id),
  searcher: async (query, items, _onCleanup) => {
    if (query.trim() === '') return items
    const words = query.trim().toLowerCase().split(' ')
    return items.filter((item) => {
      const name = item.name.toLowerCase()
      return words.every((word) => name.includes(word))
    })
  }
})

// Define models for two-way binding
const selected = defineModel<Set<SelectedKey>>('selected', {
  default: new Set()
})
const filterIndex = defineModel<number>('filterIndex', { default: 0 })
const layoutMode = defineModel<LayoutMode>('layoutMode', {
  default: 'grid'
})
const files = defineModel<File[]>('files', { default: [] })
const sortSelected = defineModel<SortOptionLabel>('sortSelected', {
  default: 'default'
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const debouncedSearchQuery = refDebounced(searchQuery, 700, {
  maxWait: 700
})
const isQuerying = ref(false)
const toastStore = useToastStore()
const popoverRef = ref<InstanceType<typeof Popover>>()
const triggerRef = useTemplateRef('triggerRef')
const isOpen = ref(false)

const maxSelectable = computed(() => {
  if (props.multiple === true) return Infinity
  if (typeof props.multiple === 'number') return props.multiple
  return 1
})

const filteredItems = ref<DropdownItem[]>([])

watch(searchQuery, (value) => {
  isQuerying.value = value !== debouncedSearchQuery.value
})

watch(
  debouncedSearchQuery,
  (_, __, onCleanup) => {
    let isCleanup = false
    let cleanupFn: undefined | (() => void)
    onCleanup(() => {
      isCleanup = true
      cleanupFn?.()
    })

    void props
      .searcher(
        debouncedSearchQuery.value,
        props.items,
        (cb) => (cleanupFn = cb)
      )
      .then((result) => {
        if (!isCleanup) filteredItems.value = result
      })
      .finally(() => {
        if (!isCleanup) isQuerying.value = false
      })
  },
  { immediate: true }
)

const sortedItems = computed(() => {
  switch (sortSelected.value) {
    case 'a-z':
      return filteredItems.value.slice().sort((a, b) => {
        return a.name.localeCompare(b.name)
      })
    case 'default':
    default:
      return filteredItems.value.slice()
  }
})

function internalIsSelected(item: DropdownItem, index: number): boolean {
  return props.isSelected?.(selected.value, item, index) ?? false
}

const toggleDropdown = (event: Event) => {
  if (popoverRef.value && triggerRef.value) {
    popoverRef.value.toggle(event, triggerRef.value)
    isOpen.value = !isOpen.value
  }
}

const closeDropdown = () => {
  if (popoverRef.value) {
    popoverRef.value.hide()
    isOpen.value = false
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    files.value = Array.from(input.files)
  }
  // Clear the input value to allow re-selecting the same file
  input.value = ''
}

function handleSelection(item: DropdownItem, index: number) {
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
      toastStore.addAlert(`Maximum selection limit reached`)
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
  <div ref="triggerRef">
    <FormDropdownInput
      :files="files"
      :is-open="isOpen"
      :placeholder="placeholder"
      :items="items"
      :max-selectable="maxSelectable"
      :selected="selected"
      :uploadable="uploadable"
      @select-click="toggleDropdown"
      @file-change="handleFileChange"
    />
    <Popover
      ref="popoverRef"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class: 'absolute z-50'
        },
        content: {
          class: ['bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg']
        }
      }"
      @hide="isOpen = false"
    >
      <FormDropdownMenu
        v-model:filter-index="filterIndex"
        v-model:layout-mode="layoutMode"
        v-model:sort-selected="sortSelected"
        v-model:search-query="searchQuery"
        :is-querying="isQuerying"
        :items="sortedItems"
        :is-selected="internalIsSelected"
        :max-selectable="maxSelectable"
        @close="closeDropdown"
        @item-click="handleSelection"
      />
    </Popover>
  </div>
</template>
