<template>
  <!--
    Note: Unlike SingleSelect, we don't need an explicit options prop because:
    1. Our value template only shows a static label (not dynamic based on selection)
    2. We display a count badge instead of actual selected labels
    3. All PrimeVue props (including options) are passed via v-bind="$attrs"
    option-label="name" is required because our option template directly accesses option.name
    max-selected-labels="0" is required to show count badge instead of selected item labels
  -->
  <MultiSelect
    v-model="selectedItems"
    v-model:open="isOpen"
    multiple
    by="value"
    :disabled
    ignore-filter
    :reset-search-term-on-select="false"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        v-bind="$attrs"
        :aria-label="label || t('g.multiSelectDropdown')"
        :class="
          cn(
            selectTriggerVariants({
              size,
              border: selectedCount > 0 ? 'active' : 'none'
            })
          )
        "
      >
        <div
          v-if="showSelectedCount || showClearButton"
          class="mt-2 flex items-center justify-between"
        >
          <span
            v-if="showSelectedCount"
            class="px-1 text-sm text-base-foreground"
          >
            {{
              selectedCount > 0
                ? $t('g.itemsSelected', { selectedCount })
                : $t('g.itemSelected', { selectedCount })
            }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ $t('g.clearAll') }}
          </Button>
        </div>
        <div :class="selectDropdownClass">
          <i class="icon-[lucide--chevron-down] text-muted-foreground" />
        </div>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <!-- Trigger value (keep text scale identical) -->
    <template #value>
      <span :class="size === 'md' ? 'text-xs' : 'text-sm'">
        {{ label }}
      </span>
      <span
        v-if="selectedCount > 0"
        class="pointer-events-none absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-base-foreground text-xs font-semibold text-base-background"
      >
        {{ selectedCount }}
      </span>
    </template>

    <!-- Chevron size identical to current -->
    <template #dropdownicon>
      <i class="icon-[lucide--chevron-down] text-muted-foreground" />
    </template>

    <!-- Custom option row: square checkbox + label (unchanged layout/colors) -->
    <template #option="slotProps">
      <div
        role="button"
        class="flex cursor-pointer items-center gap-2"
        :style="popoverStyle"
        :class="selectContentClass"
        @keydown="onContentKeydown"
        @focus-outside="preventFocusDismiss"
      >
        <div
          class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
          :class="
            slotProps.selected
              ? 'bg-primary-background'
              : 'bg-secondary-background'
          "
        >
          <ComboboxItem
            v-for="opt in filteredOptions"
            :key="opt.value"
            :value="opt"
            :class="cn('group', selectItemVariants({ layout: 'multi' }))"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded-sm transition-all duration-200 group-data-[state=checked]:bg-primary-background group-data-[state=unchecked]:bg-secondary-background [&>span]:flex"
            >
              <ComboboxItemIndicator>
                <i
                  class="icon-[lucide--check] text-xs font-bold text-base-foreground"
                />
              </ComboboxItemIndicator>
            </div>
            <span>{{ opt.name }}</span>
          </ComboboxItem>
          <ComboboxEmpty :class="selectEmptyMessageClass">
            {{ $t('g.noResultsFound') }}
          </ComboboxEmpty>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import type { FocusOutsideEvent } from 'reka-ui'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePopoverSizing } from '@/composables/usePopoverSizing'
import { cn } from '@/utils/tailwindUtil'

import {
  selectContentClass,
  selectDropdownClass,
  selectEmptyMessageClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from './select.variants'
import type { SelectOption } from './types'

type Option = SelectOption

defineOptions({
  inheritAttrs: false
})

interface Props {
  /** Input label shown on the trigger button */
  label?: string
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show search box in the panel header */
  showSearchBox?: boolean
  /** Show selected count text in the panel header */
  showSelectedCount?: boolean
  /** Show "Clear all" action in the panel header */
  showClearButton?: boolean
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
  // Note: options prop is intentionally omitted.
  // It's passed via $attrs to maximize PrimeVue API compatibility
}
const {
  label,
  size = 'lg',
  showSearchBox = false,
  showSelectedCount = false,
  showClearButton = false,
  searchPlaceholder = 'Search...',
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<Props>()

const selectedItems = defineModel<Option[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const { t } = useI18n()
const isOpen = ref(false)
const selectedCount = computed(() => selectedItems.value.length)

function onContentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopEscapeToDocument(event)
    isOpen.value = false
  }
}

function preventFocusDismiss(event: FocusOutsideEvent) {
  event.preventDefault()
}

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
const attrs = useAttrs()
const originalOptions = computed(() => (attrs.options as Option[]) || [])

// Use VueUse's useFuse for better reactivity and performance
const fuseOptions: UseFuseOptions<Option> = {
  fuseOptions: {
    keys: ['name', 'value'],
    threshold: 0.3,
    includeScore: false
  },
  matchAllWhenSearchEmpty: true
}

const { results } = useFuse(searchQuery, originalOptions, fuseOptions)

// Filter options based on search, but always include selected items
const filteredOptions = computed(() => {
  if (!searchQuery.value || searchQuery.value.trim() === '') {
    return originalOptions.value
  }

  // results.value already contains the search results from useFuse
  const searchResults = results.value.map(
    (result: { item: Option }) => result.item
  )

  // Include selected items that aren't in search results
  const selectedButNotInResults = selectedItems.value.filter(
    (item) =>
      !searchResults.some((result: Option) => result.value === item.value)
  )

  return [...selectedButNotInResults, ...searchResults]
})
</script>
