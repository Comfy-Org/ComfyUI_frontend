<template>
  <ComboboxRoot
    ref="comboboxRef"
    v-model:open="isOpen"
    ignore-filter
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    :disabled
    :open-on-focus
    :open-on-click="openOnFocus"
    :class="className"
    @highlight="onHighlight"
  >
    <ComboboxAnchor
      :class="
        cn(
          searchInputVariants({ size }),
          disabled && 'pointer-events-none opacity-50',
          anchorClass
        )
      "
      @click="focus"
      @keydown.capture="keepShiftSelectionNative"
    >
      <slot name="leading" />
      <Button
        v-if="modelValue"
        :class="cn('absolute', sizeConfig.clearPos)"
        variant="textonly"
        size="icon-sm"
        :aria-label="clearLabel"
        @click.stop="clearSearch"
      >
        <i :class="cn('icon-[lucide--x]', sizeConfig.icon)" />
      </Button>
      <i
        v-else-if="loading"
        :class="
          cn(
            'pointer-events-none absolute icon-[lucide--loader-circle] animate-spin',
            sizeConfig.iconPos,
            sizeConfig.icon
          )
        "
      />
      <i
        v-else
        :class="
          cn(
            'pointer-events-none absolute',
            sizeConfig.iconPos,
            sizeConfig.icon,
            icon
          )
        "
      />

      <ComboboxInput
        :id="inputId"
        ref="inputRef"
        v-model="modelValue"
        :class="
          cn(
            'h-full min-w-0 flex-1 border-none bg-transparent outline-none',
            sizeConfig.inputPl,
            sizeConfig.inputText
          )
        "
        :placeholder
        :aria-label="accessibleLabel"
        :auto-focus="autofocus"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @keydown.enter="onEnterKey"
      />
    </ComboboxAnchor>

    <ComboboxPortal :key="Number(isOpen)">
      <ComboboxContent
        v-if="suggestions.length > 0"
        position="popper"
        :side-offset="4"
        :style="contentStyle"
        :class="
          cn(
            'z-overlay max-h-60 w-(--reka-combobox-trigger-width) overflow-y-auto',
            'rounded-lg border bg-background p-1 shadow-lg'
          )
        "
      >
        <ComboboxItem
          v-for="(suggestion, index) in suggestions"
          :key="suggestionKey(suggestion, index)"
          :value="suggestionValue(suggestion)"
          :data-suggestion-index="index"
          :aria-label="suggestionLabel(suggestion)"
          :class="
            cn(
              'cursor-pointer rounded-sm px-3 py-2 text-sm outline-none',
              'data-highlighted:bg-accent'
            )
          "
          @select.prevent="onSelectSuggestion(suggestion)"
        >
          <slot name="suggestion" :suggestion>
            {{ suggestionLabel(suggestion) }}
          </slot>
        </ComboboxItem>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts" generic="T">
import type { HTMLAttributes, StyleValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxPortal
} from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { SearchInputVariants } from './searchInput.variants'
import {
  searchInputSizeConfig,
  searchInputVariants
} from './searchInput.variants'

const {
  placeholder,
  accessibleLabel,
  clearLabel,
  icon = 'icon-[lucide--search]',
  autofocus = false,
  inputId,
  loading = false,
  disabled = false,
  openOnFocus = false,
  updateModelOnSelect = true,
  size = 'md',
  suggestions = [],
  optionLabel,
  optionKey,
  class: className,
  anchorClass,
  contentStyle
} = defineProps<{
  placeholder?: string
  accessibleLabel: string
  clearLabel: string
  icon?: string
  autofocus?: boolean
  inputId?: string
  loading?: boolean
  disabled?: boolean
  openOnFocus?: boolean
  updateModelOnSelect?: boolean
  size?: SearchInputVariants['size']
  suggestions?: T[]
  optionLabel?: keyof T & string
  optionKey?: keyof T & string
  class?: HTMLAttributes['class']
  anchorClass?: HTMLAttributes['class']
  contentStyle?: StyleValue
}>()

const emit = defineEmits<{
  select: [item: T]
  highlight: [item: T | undefined]
}>()

const sizeConfig = computed(() => searchInputSizeConfig[size])

const modelValue = defineModel<string>({ required: true })

const comboboxRef = useTemplateRef('comboboxRef')
const inputRef = ref<InstanceType<typeof ComboboxInput> | null>(null)
const isOpen = ref(false)
const isComposing = ref(false)

function focus() {
  inputRef.value?.$el?.focus()
}

function open() {
  isOpen.value = true
}

defineExpose({ focus, open })

function clearSearch() {
  modelValue.value = ''
  focus()
}

function getItemProperty(item: T, key: keyof T & string): string {
  if (typeof item === 'object' && item !== null) {
    return String(item[key])
  }
  return String(item)
}

function suggestionLabel(item: T): string {
  if (optionLabel) return getItemProperty(item, optionLabel)
  return String(item)
}

function suggestionKey(item: T, index: number): string {
  if (optionKey) return getItemProperty(item, optionKey)
  return `${suggestionLabel(item)}-${index}`
}

function suggestionValue(item: T): string {
  return suggestionLabel(item)
}

function onSelectSuggestion(item: T) {
  if (updateModelOnSelect) modelValue.value = suggestionLabel(item)
  isOpen.value = false
  emit('select', item)
}

function onHighlight(payload: { ref: HTMLElement } | undefined) {
  const index = Number(payload?.ref.dataset.suggestionIndex)
  emit('highlight', Number.isInteger(index) ? suggestions[index] : undefined)
}

function keepShiftSelectionNative(e: KeyboardEvent) {
  if (e.target !== inputRef.value?.$el) return
  if (e.shiftKey && (e.key === 'Home' || e.key === 'End')) e.stopPropagation()
}

function onEnterKey(e: KeyboardEvent) {
  if (isComposing.value) {
    e.preventDefault()
    e.stopPropagation()
  }
}

watch(
  () => suggestions,
  async (items) => {
    isOpen.value = items.length > 0 && (openOnFocus || !!modelValue.value)
    if (isOpen.value) {
      await nextTick()
      comboboxRef.value?.highlightFirstItem?.()
    }
  }
)
</script>
