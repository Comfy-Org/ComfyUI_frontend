<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Loader from '@/components/loader/Loader.vue'
import { WidgetInputBaseClass } from '../../layout'
import type { FormDropdownInputProps } from './types'

const {
  isOpen,
  placeholder = 'Select...',
  items,
  displayItems,
  selected,
  maxSelectable,
  uploadable,
  disabled,
  accept
} = defineProps<FormDropdownInputProps>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'select-click', event: MouseEvent): void
  (e: 'file-change', event: Event): void
}>()

const selectedItems = computed(() => {
  const itemsToSearch = displayItems ?? items
  return itemsToSearch.filter((item) => selected.has(item.id))
})

const theButtonStyle = computed(() =>
  cn(
    'border-0 bg-component-node-widget-background text-text-secondary outline-none',
    disabled
      ? 'cursor-not-allowed'
      : 'cursor-pointer hover:bg-component-node-widget-background-hovered',
    selectedItems.value.length > 0 && 'text-text-primary'
  )
)

const buttonRef = ref<HTMLButtonElement>()
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

function focus() {
  buttonRef.value?.focus()
}

/**
 * Open the native file picker without a user click on the input itself.
 * Must be invoked synchronously from a user-initiated event handler so the
 * browser's transient activation requirement is satisfied. Falls back to
 * `click()` on browsers that predate showPicker (Chrome <99, Firefox <101,
 * Safari <16).
 */
function showPicker() {
  const input = fileInputRef.value!
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  } else {
    input.click()
  }
}

defineExpose({ focus, showPicker })
</script>

<template>
  <div
    :class="
      cn(WidgetInputBaseClass, 'flex text-base leading-none', {
        'cursor-not-allowed opacity-50 outline-node-component-border': disabled
      })
    "
  >
    <button
      ref="buttonRef"
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
          'relative',
          'flex size-8 items-center justify-center rounded-r-lg border-l border-node-component-border'
        )
      "
    >
      <Loader v-if="isUploading" size="sm" />
      <i
        v-else
        class="icon-[lucide--folder-search] size-4"
        aria-hidden="true"
      />
      <input
        ref="fileInputRef"
        type="file"
        class="absolute inset-0 -z-1 opacity-0"
        :aria-label="t('g.upload')"
        :multiple="maxSelectable > 1"
        :disabled="disabled"
        :accept="accept"
        @change="emit('file-change', $event)"
      />
    </label>
  </div>
</template>
