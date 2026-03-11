<template>
  <ComboboxRoot
    v-model="modelValue"
    v-model:open="isOpen"
    ignore-filter
    :disabled
    :class="className"
  >
    <ComboboxAnchor
      :class="
        cn(
          searchInputVariants({ size }),
          disabled && 'pointer-events-none opacity-50'
        )
      "
      @click="focus"
    >
      <Button
        v-if="modelValue"
        :class="cn('absolute', sizeConfig.clearPos)"
        variant="textonly"
        size="icon-sm"
        :aria-label="$t('g.clear')"
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
        ref="inputRef"
        v-model="modelValue"
        :class="
          cn(
            'size-full border-none bg-transparent outline-none',
            sizeConfig.inputPl,
            sizeConfig.inputText
          )
        "
        :placeholder="placeholderText"
        :auto-focus="autofocus"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @keydown.enter="onEnterKey"
      />
    </ComboboxAnchor>

    <ComboboxContent
      v-if="suggestions.length > 0"
      position="popper"
      :side-offset="4"
      :class="
        cn(
          'z-50 max-h-60 w-(--reka-combobox-trigger-width) overflow-y-auto',
          'rounded-lg border border-border-default bg-base-background p-1 shadow-lg'
        )
      "
    >
      <ComboboxItem
        v-for="(suggestion, index) in suggestions"
        :key="suggestionKey(suggestion, index)"
        :value="suggestionValue(suggestion)"
        :class="
          cn(
            'cursor-pointer rounded-sm px-3 py-2 text-sm outline-none',
            'data-highlighted:bg-secondary-background-hover'
          )
        "
        @select.prevent="onSelectSuggestion(suggestion)"
      >
        <slot name="suggestion" :suggestion>
          {{ suggestionLabel(suggestion) }}
        </slot>
      </ComboboxItem>
    </ComboboxContent>
  </ComboboxRoot>
</template>

<script setup lang="ts" generic="T">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SearchInputVariants } from './searchInput.variants'
import {
  searchInputSizeConfig,
  searchInputVariants
} from './searchInput.variants'

const { t } = useI18n()

const {
  placeholder,
  icon = 'icon-[lucide--search]',
  autofocus = false,
  loading = false,
  disabled = false,
  size = 'md',
  suggestions = [],
  optionLabel,
  optionKey,
  class: className
} = defineProps<{
  placeholder?: string
  icon?: string
  autofocus?: boolean
  loading?: boolean
  disabled?: boolean
  size?: SearchInputVariants['size']
  suggestions?: T[]
  optionLabel?: keyof T & string
  optionKey?: keyof T & string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  select: [item: T]
}>()

const sizeConfig = computed(() => searchInputSizeConfig[size])

const modelValue = defineModel<string>({ required: true })

const inputRef = ref<InstanceType<typeof ComboboxInput> | null>(null)
const isOpen = ref(false)
const isComposing = ref(false)

function focus() {
  inputRef.value?.$el?.focus()
}

defineExpose({ focus })

const placeholderText = computed(
  () => placeholder ?? t('g.searchPlaceholder', { subject: '' })
)

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
  modelValue.value = suggestionLabel(item)
  isOpen.value = false
  emit('select', item)
}

function onEnterKey(e: KeyboardEvent) {
  if (isComposing.value) {
    e.preventDefault()
    e.stopPropagation()
  }
}

watch(
  () => suggestions,
  (items) => {
    isOpen.value = items.length > 0 && !!modelValue.value
  }
)
</script>
