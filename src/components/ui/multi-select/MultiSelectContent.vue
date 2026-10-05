<template>
  <ComboboxPortal>
    <ComboboxContent
      position="popper"
      :side-offset="8"
      align="start"
      :style="[popoverStyle, contentStyle, liftedContentStyle]"
      :class="cn(selectContentClass, 'flex flex-col')"
      @keydown="onKeydown"
      @focus-outside="preventFocusDismiss"
    >
      <FocusScope class="contents" @mount-auto-focus.prevent>
        <div v-if="showSearchBox" class="px-2 pt-2 pb-0">
          <div
            class="flex items-center gap-2 rounded-lg border border-solid border-border-default px-3 py-1.5"
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
        </div>

        <div
          v-if="hasActions && actionsPlacement === 'header'"
          :class="actionsClass"
        >
          <span
            v-if="showSelectedCount"
            class="px-1 text-sm text-muted-foreground"
          >
            {{ t('g.itemsSelected', { count: selectedItems.length }) }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ t('g.clearAll') }}
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
            {{ t('g.noResultsFound') }}
          </ComboboxEmpty>
        </ComboboxViewport>

        <div
          v-if="hasActions && actionsPlacement === 'footer'"
          :class="actionsClass"
        >
          <span
            v-if="showSelectedCount"
            class="px-1 text-sm text-muted-foreground"
          >
            {{ t('g.itemsSelected', { count: selectedItems.length }) }}
          </span>
          <Button
            v-if="showClearButton"
            variant="textonly"
            size="md"
            @click.stop="selectedItems = []"
          >
            {{ t('g.clearAll') }}
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
  ComboboxPortal,
  ComboboxViewport,
  FocusScope
} from 'reka-ui'
import { computed } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'

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
  showSearchBox,
  showSelectedCount,
  showClearButton,
  actionsPlacement,
  searchPlaceholder,
  listMaxHeight,
  popoverStyle,
  contentStyle,
  liftedContentStyle
} = defineProps<{
  options: SelectOption[]
  showSearchBox: boolean
  showSelectedCount: boolean
  showClearButton: boolean
  actionsPlacement: 'header' | 'footer'
  searchPlaceholder?: string
  listMaxHeight: string
  popoverStyle: StyleValue
  contentStyle?: StyleValue
  liftedContentStyle: StyleValue
}>()

const emit = defineEmits<{
  escape: []
}>()

const selectedItems = defineModel<SelectOption[]>({ required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })

const { t } = useI18n()
const hasActions = computed(() => showSelectedCount || showClearButton)
const actionsClass = computed(() =>
  cn(
    'flex shrink-0 items-center justify-between',
    actionsPlacement === 'header'
      ? 'mt-2 border-b border-border-default px-2 pb-4'
      : '-mx-2 mt-2 border-t border-border-default px-4 pt-3 pb-1'
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
