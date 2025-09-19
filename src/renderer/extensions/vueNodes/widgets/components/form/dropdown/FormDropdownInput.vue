<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../../layout'

interface Props {
  isOpen?: boolean
  placeholder?: string
  files: File[]
  items: unknown[]
  selected: Set<number>
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
  return Array.from(props.selected).map((index) => props.items[index])
})

const chevronClass = computed(() =>
  cn('mr-2 size-4 transition-transform duration-200', {
    'rotate-180': props.isOpen
  })
)

const theButtonStyle = [
  'bg-transparent border-none outline-none cursor-pointer text-zinc-400',
  'hover:bg-zinc-500/30 hover:text-black hover:dark-theme:text-white'
]
</script>

<template>
  <div :class="cn(WidgetInputBaseClass, 'flex text-base leading-none')">
    <!-- Dropdown -->
    <button
      :class="
        cn(
          'flex justify-between items-center flex-1 h-8 rounded-l-lg',
          theButtonStyle
        )
      "
      @click="emit('select-click', $event)"
    >
      <span class="px-4 py-2">
        <span v-if="!selectedItems.length">
          {{ props.placeholder }}
        </span>
        <span v-else class="line-clamp-1">
          {{ selectedItems.map((item) => (item as any)?.name).join(', ') }}
        </span>
      </span>
      <i-lucide:chevron-down :class="chevronClass" />
    </button>
    <!-- Open File -->
    <label
      :class="
        cn(
          'relative',
          'size-8 flex justify-center items-center border-l rounded-r-lg border-zinc-300/10',
          theButtonStyle
        )
      "
    >
      <i-lucide:folder-search class="size-4" />
      <input
        type="file"
        class="opacity-0 absolute inset-0 -z-1"
        @change="emit('file-change', $event)"
      />
    </label>
  </div>
</template>
