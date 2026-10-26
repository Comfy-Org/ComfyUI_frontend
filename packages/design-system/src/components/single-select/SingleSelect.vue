<template>
  <SearchableSingleSelect
    v-if="searchable && searchLabel !== undefined && emptyText !== undefined"
    v-model="selectedItem"
    v-bind="attrsWithoutClass"
    :class="attrsClass"
    :label
    :accessible-label
    :search-label
    :empty-text
    :options
    :size
    :invalid
    :loading
    :disabled
    :search-placeholder
    :list-max-height
    :popover-min-width
    :popover-max-width
    :content-style
  >
    <template #icon><slot name="icon" /></template>
  </SearchableSingleSelect>

  <SelectRoot v-else v-model="selectedItem" v-model:open="isOpen" :disabled>
    <SelectTrigger
      v-bind="attrsWithoutClass"
      :aria-label="accessibleLabel"
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
        <i
          class="icon-[lucide--chevron-down] size-[1.2em] text-muted-foreground"
        />
      </div>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        align="start"
        :style="[optionStyle, contentStyle]"
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
                class="icon-[lucide--check] text-foreground"
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
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  SelectPortal
} from 'reka-ui'
import { ref } from 'vue'

import {
  selectContentClass,
  selectDropdownClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@comfyorg/design-system/select.variants'
import type { SingleSelectProps } from './types'
import { useAttrsClass } from '@comfyorg/design-system/lib/composables/useAttrsClass'
import { usePopoverSizing } from '@comfyorg/design-system/lib/composables/usePopoverSizing'
import { cn } from '@comfyorg/tailwind-utils'

import SearchableSingleSelect from './SearchableSingleSelect.vue'

defineOptions({
  inheritAttrs: false
})
const { attrsClass, attrsWithoutClass } = useAttrsClass()

const {
  label,
  accessibleLabel,
  searchLabel,
  emptyText,
  options = [],
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
} = defineProps<SingleSelectProps>()

const selectedItem = defineModel<string | number | undefined>({
  required: true
})

const isOpen = ref(false)

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
