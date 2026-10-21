<template>
  <ComboboxPortal :key="Number(open)">
    <ComboboxContent
      position="popper"
      :side-offset="8"
      align="start"
      :style="[popoverStyle, contentStyle]"
      :class="cn(selectContentClass, 'flex flex-col')"
      @keydown="onKeydown"
      @focus-outside="preventFocusDismiss"
    >
      <FocusScope class="contents" @mount-auto-focus.prevent>
        <div v-if="showSearchBox" class="px-2 pt-2 pb-0">
          <div
            class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          >
            <i class="icon-[lucide--search] shrink-0 text-muted-foreground" />
            <ComboboxInput
              v-model="searchQuery"
              :placeholder="searchPlaceholder"
              :aria-label="searchLabel"
              class="w-full border-none bg-transparent outline-none"
            />
          </div>
        </div>

        <div
          v-if="hasActions && actionsPlacement === 'header'"
          :class="actionsClass"
        >
          <span
            v-if="formatSelectedCount"
            class="px-1 text-sm text-muted-foreground"
          >
            {{ formatSelectedCount(selectedItems.length) }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ clearAllLabel }}
          </Button>
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
              class="flex size-4 shrink-0 items-center justify-center rounded-sm transition-all duration-200 group-data-[state=checked]:bg-primary group-data-[state=unchecked]:bg-secondary [&>span]:flex"
            >
              <ComboboxItemIndicator>
                <i
                  class="icon-[lucide--check] text-xs font-bold text-foreground"
                />
              </ComboboxItemIndicator>
            </div>
            <span>{{ opt.name }}</span>
          </ComboboxItem>
          <ComboboxEmpty :class="selectEmptyMessageClass">
            {{ emptyText }}
          </ComboboxEmpty>
        </ComboboxViewport>

        <div
          v-if="hasActions && actionsPlacement === 'footer'"
          :class="actionsClass"
        >
          <span
            v-if="formatSelectedCount"
            class="px-1 text-sm text-muted-foreground"
          >
            {{ formatSelectedCount(selectedItems.length) }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ clearAllLabel }}
          </Button>
        </div>
      </FocusScope>
    </ComboboxContent>
  </ComboboxPortal>
</template>

<script setup lang="ts">
import type { FocusOutsideEvent } from 'reka-ui'
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxViewport,
  FocusScope,
  injectComboboxRootContext,
  ComboboxPortal
} from 'reka-ui'
import { computed } from 'vue'
import type { StyleValue } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { SelectOption } from '@/components/ui/select/types'
import { useSelectSearch } from '@/components/ui/select/useSelectSearch'

import {
  selectContentClass,
  selectEmptyMessageClass,
  selectItemVariants,
  stopEscapeToDocument
} from '@comfyorg/design-system/select.variants'
import { cn } from '@comfyorg/tailwind-utils'

const {
  options,
  searchLabel,
  emptyText,
  clearAllLabel,
  formatSelectedCount,
  showSearchBox,
  showClearButton,
  actionsPlacement,
  searchPlaceholder,
  listMaxHeight,
  popoverStyle,
  contentStyle
} = defineProps<{
  searchLabel?: string
  emptyText: string
  clearAllLabel?: string
  formatSelectedCount?: (count: number) => string
  options: SelectOption[]
  showSearchBox: boolean
  showClearButton: boolean
  actionsPlacement: 'header' | 'footer'
  searchPlaceholder?: string
  listMaxHeight: string
  popoverStyle: StyleValue
  contentStyle?: StyleValue
}>()

const { open } = injectComboboxRootContext()

const emit = defineEmits<{
  escape: []
}>()

const selectedItems = defineModel<SelectOption[]>({ required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })

const hasActions = computed(
  () => Boolean(formatSelectedCount) || showClearButton
)
const actionsClass = computed(() =>
  cn(
    'flex shrink-0 items-center justify-between',
    actionsPlacement === 'header'
      ? 'mt-2 border-b px-2 pb-4'
      : '-mx-2 mt-2 border-t px-4 pt-3 pb-1'
  )
)
const searchResults = useSelectSearch(searchQuery, () => options)
const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) return options

  const selectedButNotInResults = selectedItems.value.filter(
    (item) => !searchResults.value.some(({ value }) => value === item.value)
  )
  return [...selectedButNotInResults, ...searchResults.value]
})

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  stopEscapeToDocument(event)
  emit('escape')
}

function preventFocusDismiss(event: FocusOutsideEvent) {
  event.preventDefault()
}
</script>
