<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../../layout'
import type { DropdownItem, SelectedKey } from './types'

interface Props {
  isOpen?: boolean
  placeholder?: string
  files: File[]
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

const chevronClass = computed(() =>
  cn(
    'mr-2 size-4 transition-transform duration-200 flex-shrink-0 text-button-icon',
    {
      'rotate-180': props.isOpen
    }
  )
)

const theButtonStyle = computed(() =>
  cn('bg-transparent border-0 outline-none text-text-secondary', {
    'hover:bg-node-component-widget-input-surface/30 cursor-pointer':
      !props.disabled,
    'cursor-not-allowed': props.disabled,
    'text-text-primary': selectedItems.value.length > 0
  })
)
</script>

<template>
  <div
    :class="
      cn(WidgetInputBaseClass, 'flex text-base leading-none', {
        'opacity-50 cursor-not-allowed !outline-zinc-300/10': disabled
      })
    "
  >
    <!-- Dropdown -->
    <button
      :class="
        cn(theButtonStyle, 'flex justify-between items-center flex-1 h-8', {
          'rounded-l-lg': uploadable,
          'rounded-lg': !uploadable
        })
      "
      @click="emit('select-click', $event)"
    >
      <span class="min-w-0 px-4 py-2 text-left">
        <span v-if="!selectedItems.length" class="min-w-0">
          {{ props.placeholder }}
        </span>
        <span v-else class="line-clamp-1 min-w-0 break-all">
          {{ selectedItems.map((item) => (item as any)?.name).join(', ') }}
        </span>
      </span>
      <i class="icon-[lucide--chevron-down]" :class="chevronClass" />
    </button>
    <!-- Open File -->
    <label
      v-if="uploadable"
      :class="
        cn(
          theButtonStyle,
          'relative',
          'size-8 flex justify-center items-center border-l rounded-r-lg border-zinc-300/10'
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
      />
    </label>
  </div>
</template>
