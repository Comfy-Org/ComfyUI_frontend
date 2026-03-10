<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger
      :disabled
      :class="
        cn(
          'relative inline-flex cursor-pointer items-center select-none',
          size === 'md' ? 'h-8' : 'h-10',
          'rounded-lg bg-secondary-background text-base-foreground',
          'transition-all duration-200 ease-in-out',
          'hover:bg-secondary-background-hover',
          'border-[2.5px] border-solid',
          selectedCount > 0 ? 'border-base-foreground' : 'border-transparent',
          'focus:border-base-foreground',
          disabled && 'cursor-default opacity-30 hover:bg-secondary-background'
        )
      "
      :aria-label="label || t('g.multiSelectDropdown')"
      role="combobox"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
    >
      <div
        :class="
          cn(
            'flex flex-1 items-center whitespace-nowrap',
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
      <span
        class="flex shrink-0 cursor-pointer items-center justify-center px-3"
      >
        <i class="icon-[lucide--chevron-down] text-muted-foreground" />
      </span>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="8"
        :collision-padding="10"
        :style="popoverStyle"
        :class="
          cn(
            'z-3000 rounded-lg p-2',
            'bg-base-background text-base-foreground',
            'border border-solid border-border-default',
            'shadow-md',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2'
          )
        "
      >
        <div
          v-if="showSearchBox || showSelectedCount || showClearButton"
          class="flex flex-col px-2 pt-2 pb-0"
        >
          <SearchInput
            v-if="showSearchBox"
            v-model="searchQuery"
            :class="showSelectedCount || showClearButton ? 'mb-2' : ''"
            :placeholder="searchPlaceholder"
            size="sm"
          />
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
          <div class="my-4 h-px bg-border-default"></div>
        </div>

        <ListboxRoot
          v-model="selectedItems"
          multiple
          selection-behavior="toggle"
          by="value"
          :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
          class="flex scrollbar-custom flex-col gap-0 overflow-auto"
        >
          <ListboxContent>
            <ListboxItem
              v-for="option in filteredOptions"
              :key="option.value"
              :value="option"
              :class="
                cn(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none',
                  'hover:bg-secondary-background-hover',
                  'data-highlighted:bg-secondary-background-selected data-highlighted:hover:bg-secondary-background-selected'
                )
              "
            >
              <div
                class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
                :class="
                  isSelected(option)
                    ? 'bg-primary-background'
                    : 'bg-secondary-background'
                "
              >
                <i
                  v-if="isSelected(option)"
                  class="text-bold icon-[lucide--check] text-xs text-base-foreground"
                />
              </div>
              <span>{{ option.name }}</span>
            </ListboxItem>
          </ListboxContent>
        </ListboxRoot>

        <p
          v-if="filteredOptions.length === 0"
          class="px-3 pb-4 text-sm text-muted-foreground"
        >
          {{ $t('g.noResults') }}
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import {
  ListboxContent,
  ListboxItem,
  ListboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { usePopoverSizing } from '@/composables/usePopoverSizing'
import { cn } from '@/utils/tailwindUtil'

import type { SelectOption } from './types'

type Option = SelectOption

const {
  label,
  options = [],
  size = 'lg',
  disabled = false,
  showSearchBox = false,
  showSelectedCount = false,
  showClearButton = false,
  searchPlaceholder = 'Search...',
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<{
  /** Input label shown on the trigger button */
  label?: string
  /** Available options */
  options?: Option[]
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

const selectedItems = defineModel<Option[]>({
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const isOpen = ref(false)
const { t } = useI18n()
const selectedCount = computed(() => selectedItems.value.length)

const popoverStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})

function isSelected(option: Option): boolean {
  return selectedItems.value.some((item) => item.value === option.value)
}

const fuseOptions: UseFuseOptions<Option> = {
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
    (result: { item: Option }) => result.item
  )

  const selectedButNotInResults = selectedItems.value.filter(
    (item) =>
      !searchResults.some((result: Option) => result.value === item.value)
  )

  return [...selectedButNotInResults, ...searchResults]
})
</script>
