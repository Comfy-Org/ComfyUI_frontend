<template>
  <SelectRoot v-model="selectedItem" v-model:open="isOpen" :disabled>
    <SelectTrigger
      v-bind="attrsWithoutClass"
      :aria-label="label || t('g.singleSelectDropdown')"
      :aria-busy="loading || undefined"
      :aria-invalid="invalid || undefined"
      :class="
        cn(
          selectTriggerVariants({
            size,
            border: invalid ? 'invalid' : 'none'
          }),
          attrsClass
        )
      "
    >
      <div
        :class="
          cn(
            'flex flex-1 items-center gap-2 overflow-hidden py-2 pl-2',
            size === 'md' ? 'text-xs' : 'text-sm'
          )
        "
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] shrink-0 animate-spin text-muted-foreground"
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
        :style="[optionStyle, contentStyle, liftedContentStyle]"
        :class="cn(selectContentClass, 'min-w-(--reka-select-trigger-width)')"
        @keydown="onContentKeydown"
      >
        <div v-if="searchable" class="px-2 pt-2">
          <div
            class="flex items-center gap-2 rounded-lg border border-solid border-border-default px-3 py-1.5"
          >
            <i class="icon-[lucide--search] text-muted-foreground" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              :aria-label="t('g.search')"
              :placeholder="searchPlaceholder ?? t('g.search')"
              class="w-full border-none bg-transparent text-sm outline-none"
              @keydown="onSearchKeydown"
            />
          </div>
        </div>
        <SelectViewport
          :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
          class="scrollbar-custom w-full"
        >
          <SelectItem
            v-for="opt in filteredOptions"
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
import { computed, nextTick, ref, watch } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  selectContentClass,
  selectDropdownClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@/components/ui/select/select.variants'
import { useAttrsClass } from '@/composables/useAttrsClass'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { usePopoverSizing } from '@/composables/usePopoverSizing'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})
const { attrsClass, attrsWithoutClass } = useAttrsClass()

const {
  label,
  options,
  size = 'lg',
  invalid = false,
  loading = false,
  disabled = false,
  searchable = false,
  searchPlaceholder,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth,
  contentStyle
} = defineProps<{
  label?: string
  options?: { name: string; value: string | number }[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show invalid (destructive) border */
  invalid?: boolean
  /** Show loading spinner instead of chevron */
  loading?: boolean
  /** Disable the select */
  disabled?: boolean
  /** Show an input that filters options by name */
  searchable?: boolean
  searchPlaceholder?: string
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}>()

const selectedItem = defineModel<string | number | undefined>({
  required: true
})

const { t } = useI18n()
const isOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const liftedContentStyle = useModalLiftedZIndex(isOpen)
const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return options
  return options?.filter(({ name }) => name.toLocaleLowerCase().includes(query))
})

watch(isOpen, async (open) => {
  if (!open || !searchable) return
  searchQuery.value = ''
  await nextTick()
  searchInputRef.value?.focus()
})

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') event.stopPropagation()
}

function onContentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopEscapeToDocument(event)
    isOpen.value = false
  }
}

const optionStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
</script>
