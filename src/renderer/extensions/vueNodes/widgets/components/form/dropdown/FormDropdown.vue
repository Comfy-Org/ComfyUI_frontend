<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref, useTemplateRef } from 'vue'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
import type { DropdownItem } from './types'

interface Props {
  items: DropdownItem[]
  placeholder?: string
  /**
   * If true, allows multiple selections. If a number is provided,
   * it specifies the maximum number of selections allowed.
   */
  multiple?: boolean | number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  multiple: false
})

// Define models for two-way binding
const selected = defineModel<Set<number>>('selected', { default: new Set() })
const filterIndex = defineModel<number>('filterIndex', { default: 0 })
const layoutMode = defineModel<'list' | 'grid'>('layoutMode', {
  default: 'grid'
})

const popoverRef = ref<InstanceType<typeof Popover>>()
const triggerRef = useTemplateRef('triggerRef')
const isOpen = ref(false)

const maxSelectable = computed(() => {
  if (props.multiple === true) return Infinity
  if (typeof props.multiple === 'number') return props.multiple
  return 1
})

function isSelected(_item: DropdownItem, index: number): boolean {
  return selected.value.has(index)
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

const files = ref<File[]>([])

// TODO handleFileChange
function handleFileChange(event: Event) {
  // 处理文件选择事件
  console.log('File selected:', event)
  const input = event.target as HTMLInputElement
  if (input.files) {
    files.value = Array.from(input.files)
    console.log('Selected files:', files.value)
  }
  // Clear the input value to allow re-selecting the same file
  input.value = ''
}

function handleSelection(item: DropdownItem, index: number) {
  const sel = selected.value
  if (isSelected(item, index)) {
    sel.delete(index)
  } else {
    if (sel.size < maxSelectable.value) {
      sel.add(index)
    } else if (maxSelectable.value === 1) {
      sel.clear()
      sel.add(index)
    } else {
      handleMaxSelectionReached()
      return
    }
  }
  selected.value = new Set(sel)

  if (maxSelectable.value === 1) {
    closeDropdown()
  }
}

function handleMaxSelectionReached() {
  // TODO: Optionally provide user feedback when max selection is reached
  console.log('Maximum selection limit reached')
}
</script>

<template>
  <div ref="triggerRef">
    <FormDropdownInput
      :files="files"
      :is-open="isOpen"
      :placeholder="placeholder"
      :items="items"
      :selected="selected"
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
        :items="items"
        :is-selected="isSelected"
        :max-selectable="maxSelectable"
        @close="closeDropdown"
        @item-click="handleSelection"
      />
    </Popover>
  </div>
</template>
