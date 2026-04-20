<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../../layout'
import type { FormDropdownItem } from './types'

interface Props {
  isOpen?: boolean
  placeholder?: string
  items: FormDropdownItem[]
  /** Items used for display in the input field. Falls back to items if not provided. */
  displayItems?: FormDropdownItem[]
  selected: Set<string>
  maxSelectable: number
  uploadable: boolean
  disabled: boolean
  accept?: string
  loading?: boolean
}

const {
  isOpen,
  placeholder = 'Select...',
  items,
  displayItems,
  selected,
  maxSelectable,
  uploadable,
  disabled,
  accept,
  loading = false
} = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select-click', event: MouseEvent): void
  (e: 'file-change', event: Event): void
}>()

const { t } = useI18n()

const selectedItems = computed(() => {
  const itemsToSearch = displayItems ?? items
  return itemsToSearch.filter((item) => selected.has(item.id))
})

const triggerDisabled = computed(() => disabled || loading)

const theButtonStyle = computed(() =>
  cn(
    'border-0 bg-component-node-widget-background text-text-secondary outline-none',
    triggerDisabled.value
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
        'cursor-not-allowed opacity-50 outline-node-component-border':
          triggerDisabled
      })
    "
  >
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
      :disabled="triggerDisabled"
      :aria-busy="loading || undefined"
      @click="emit('select-click', $event)"
    >
      <span class="min-w-0 flex-1 truncate px-1 py-2 text-left">
        <span v-if="loading">{{ t('g.loading') }}...</span>
        <span v-else-if="!selectedItems.length">
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
            'mr-2 size-4 shrink-0 text-component-node-foreground-secondary transition-transform duration-200',
            isOpen && 'rotate-180'
          )
        "
      />
    </button>
    <label
      v-if="uploadable"
      :class="
        cn(
          theButtonStyle,
          'relative flex size-8 items-center justify-center rounded-r-lg border-l border-node-component-border',
          loading && 'cursor-wait'
        )
      "
      :aria-busy="loading || undefined"
    >
      <i
        :class="
          cn(
            'size-4',
            loading
              ? 'icon-[lucide--loader-circle] animate-spin'
              : 'icon-[lucide--folder-search]'
          )
        "
      />
      <input
        type="file"
        class="absolute inset-0 -z-1 opacity-0"
        :multiple="maxSelectable > 1"
        :disabled="triggerDisabled"
        :accept="accept"
        @change="emit('file-change', $event)"
      />
    </label>
  </div>
</template>
