<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref, useTemplateRef } from 'vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  multiple: false,
  uploadable: false,
  isSelected: (
    selected: Set<SelectedKey>,
    item: DropdownItem,
    _index: number
  ) => selected.has(item.id)
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

const toastStore = useToastStore()
const popoverRef = ref<InstanceType<typeof Popover>>()
const triggerRef = useTemplateRef('triggerRef')
const isOpen = ref(false)

const maxSelectable = computed(() => {
  if (props.multiple === true) return Infinity
  if (typeof props.multiple === 'number') return props.multiple
  return 1
})

const sortedItems = computed(() => {
  switch (sortSelected.value) {
    case 'a-z':
      return props.items.slice().sort((a, b) => {
        return a.name.localeCompare(b.name)
      })
    case 'default':
    default:
      return props.items.slice()
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
        :items="sortedItems"
        :is-selected="internalIsSelected"
        :max-selectable="maxSelectable"
        @close="closeDropdown"
        @item-click="handleSelection"
      />
    </Popover>
  </div>
</template>
