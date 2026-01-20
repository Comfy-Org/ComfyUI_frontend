<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../../layout'
import type { DropdownItem, SelectedKey } from './types'

interface Props {
  isOpen?: boolean
  placeholder?: string
  items: DropdownItem[]
  selected: Set<SelectedKey>
  maxSelectable: number
  uploadable: boolean
  disabled: boolean
  accept?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  placeholder: 'Select...'
})

const emit = defineEmits<{
  (e: 'select-click', event: MouseEvent): void
  (e: 'file-change', event: Event): void
}>()

const selectedItems = computed(() => {
  return props.items.filter((item) => props.selected.has(item.id))
})

const theButtonStyle = computed(() =>
  cn(
    'border-0 bg-component-node-widget-background text-text-secondary outline-none',
    props.disabled
      ? 'cursor-not-allowed'
      : 'cursor-pointer hover:bg-component-node-widget-background-hovered',
    selectedItems.value.length > 0 && 'text-text-primary'
  )
)
</script>

<template>
  <div
    :class="
      cn(WidgetInputBaseClass, 'flex text-base leading-none', {
        'cursor-not-allowed opacity-50 !outline-zinc-300/10': disabled
      })
    "
  >
    <!-- Dropdown -->
    <button
      :class="
        cn(
          theButtonStyle,
          'flex h-8 min-w-0 flex-1 items-center justify-between',
          {
            'rounded-l-lg': uploadable,
            'rounded-lg': !uploadable
          }
        )
      "
      @click="emit('select-click', $event)"
    >
      <span class="min-w-0 flex-1 truncate px-1 py-2 text-left">
        <span v-if="!selectedItems.length">
          {{ placeholder }}
        </span>
        <span v-else>
          {{ selectedItems.map((item) => item.label ?? item.name).join(', ') }}
        </span>
      </span>
      <i
        class="icon-[lucide--chevron-down]"
        :class="
          cn(
            'mr-2 size-4 flex-shrink-0 text-component-node-foreground-secondary transition-transform duration-200',
            isOpen && 'rotate-180'
          )
        "
      />
    </button>
    <!-- Open File -->
    <label
      v-if="uploadable"
      :class="
        cn(
          theButtonStyle,
          'relative',
          'flex size-8 items-center justify-center rounded-r-lg border-l border-zinc-300/10'
        )
      "
    >
      <i class="icon-[lucide--folder-search] size-4" />
      <input
        type="file"
        class="absolute inset-0 -z-1 opacity-0"
        :multiple="maxSelectable > 1"
        :disabled="disabled"
        :accept="accept"
        @change="emit('file-change', $event)"
      >
    </label>
  </div>
</template>
