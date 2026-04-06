<template>
  <SelectRoot v-model="selectedItem" v-model:open="isOpen" :disabled>
    <SelectTrigger
      v-bind="$attrs"
      :aria-label="label || t('g.singleSelectDropdown')"
      :aria-busy="loading || undefined"
      :aria-invalid="invalid || undefined"
      :class="
        selectTriggerVariants({
          size,
          border: invalid ? 'invalid' : 'none'
        })
      "
    >
      <div
        :class="
          cn('flex items-center gap-2', size === 'md' ? 'text-xs' : 'text-sm')
        "
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] animate-spin text-muted-foreground"
        />
        <slot v-else name="icon" />
        <SelectValue :placeholder="label" class="truncate" />
      </div>
      <div :class="selectDropdownClass">
        <i class="icon-[lucide--chevron-down] text-muted-foreground" />
      </div>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        align="start"
        :style="optionStyle"
        :class="cn(selectContentClass, 'min-w-(--reka-select-trigger-width)')"
        @keydown="onContentKeydown"
      >
        <SelectViewport
          :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
          class="scrollbar-custom w-full"
        >
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            :class="selectItemVariants({ layout: 'single' })"
          >
            <SelectItemText class="truncate">
              {{ opt.name }}
            </SelectItemText>
            <SelectItemIndicator
              class="flex shrink-0 items-center justify-center"
            >
              <i
                class="icon-[lucide--check] text-base-foreground"
                aria-hidden="true"
              />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import {
  selectContentClass,
  selectDropdownClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from './select.variants'
import type { SelectOption } from './types'

defineOptions({
  inheritAttrs: false
})

const {
  label,
  options,
  size = 'lg',
  invalid = false,
  loading = false,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<{
  label?: string
  /**
   * Required for displaying the selected item's label.
   * Cannot rely on $attrs alone because we need to access options
   * in getLabel() to map values to their display names.
   */
  options?: SelectOption[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show invalid (destructive) border */
  invalid?: boolean
  /** Show loading spinner instead of chevron */
  loading?: boolean
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
}>()

const selectedItem = defineModel<string | undefined>({ required: true })

const { t } = useI18n()
const isOpen = ref(false)

function onContentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopEscapeToDocument(event)
    isOpen.value = false
  }
}

/**
 * Maps a value to its display label.
 * Necessary because PrimeVue's value slot doesn't provide the selected item's label,
 * only the raw value. We need this to show the correct text when an item is selected.
 */
const getLabel = (val: string | null | undefined) => {
  if (val == null) return label ?? ''
  if (!options) return label ?? ''
  const found = options.find((o) => o.value === val)
  return found ? found.name : (label ?? '')
}

// Extract complex style logic from template
const optionStyle = computed(() => {
  if (!popoverMinWidth && !popoverMaxWidth) return undefined

  const styles: string[] = []
  if (popoverMinWidth) styles.push(`min-width: ${popoverMinWidth}`)
  if (popoverMaxWidth) styles.push(`max-width: ${popoverMaxWidth}`)

  return styles.join('; ')
})
</script>
