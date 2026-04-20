<template>
  <ComboboxRoot
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
          :class="
            cn(
              'flex flex-1 items-center overflow-hidden py-2 whitespace-nowrap',
              size === 'md' ? 'pl-3' : 'pl-4'
            )
          "
        >
          <span :class="size === 'md' ? 'text-xs' : 'text-sm'">
            {{ label }}
          </span>
          <span
            v-if="selectedCount > 0"
            class="pointer-events-none absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-base-foreground text-xs font-semibold text-base-background"
          >
            {{ selectedCount }}
          </span>
        </div>
        <div :class="selectDropdownClass">
          <i class="icon-[lucide--chevron-down] text-muted-foreground" />
        </div>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="8"
        align="start"
        :style="popoverStyle"
        :class="selectContentClass"
        @keydown="onContentKeydown"
        @focus-outside="preventFocusDismiss"
      >
        <div
          v-if="showSearchBox || showSelectedCount || showClearButton"
          class="flex flex-col px-2 pt-2 pb-0"
        >
          <div
            v-if="showSearchBox"
            :class="
              cn(
                'flex items-center gap-2 rounded-lg border border-solid border-border-default px-3 py-1.5',
                (showSelectedCount || showClearButton) && 'mb-2'
              )
            "
          >
            <i
              class="icon-[lucide--search] shrink-0 text-sm text-muted-foreground"
            />
            <ComboboxInput
              v-model="searchQuery"
              :placeholder="searchPlaceholder ?? t('g.search')"
              class="w-full border-none bg-transparent text-sm outline-none"
            />
          </div>
          <div
            v-if="showSelectedCount || showClearButton"
            class="mt-2 flex items-center justify-between"
          >
            <span
              v-if="showSelectedCount"
              class="px-1 text-sm text-base-foreground"
            >
              {{ $t('g.itemsSelected', { count: selectedCount }) }}
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
          <div class="my-4 h-px bg-border-default" />
        </div>

        <ComboboxViewport
          :class="
            cn(
              'flex flex-col gap-0 p-0 text-sm',
              'scrollbar-custom overflow-y-auto',
              'min-w-(--reka-combobox-trigger-width)'
            )
          "
          :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
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

import Button from '@/components/ui/button/Button.vue'
import {
  selectContentClass,
  selectDropdownClass,
  selectEmptyMessageClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@/components/ui/select/select.variants'
import type { SelectOption } from '@/components/ui/select/types'
import { usePopoverSizing } from '@/composables/usePopoverSizing'
import { cn } from '@/utils/tailwindUtil'

defineOptions({
  inheritAttrs: false
})

const {
  label,
  options = [],
  size = 'lg',
  disabled = false,
  showSearchBox = false,
  showSelectedCount = false,
  showClearButton = false,
  searchPlaceholder,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<{
  /** Input label shown on the trigger button */
  label?: string
  /** Available options */
  options?: SelectOption[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Disable the select */
  disabled?: boolean
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
}>()

const selectedItems = defineModel<SelectOption[]>({
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

const fuseOptions: UseFuseOptions<SelectOption> = {
  fuseOptions: {
    keys: ['name', 'value'],
    threshold: 0.3,
    includeScore: false
  },
  matchAllWhenSearchEmpty: true
}

const { results } = useFuse(searchQuery, () => options, fuseOptions)

const filteredOptions = computed(() => {
  if (!searchQuery.value || searchQuery.value.trim() === '') {
    return options
  }

  const searchResults = results.value.map(
    (result: { item: SelectOption }) => result.item
  )

  const selectedButNotInResults = selectedItems.value.filter(
    (item) =>
      !searchResults.some((result: SelectOption) => result.value === item.value)
  )

  return [...selectedButNotInResults, ...searchResults]
})
</script>
