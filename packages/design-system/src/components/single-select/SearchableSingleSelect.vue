<template>
  <ComboboxRoot
    v-model="selectedOption"
    v-model:open="isOpen"
    by="value"
    :disabled
    ignore-filter
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        ref="trigger"
        v-bind="attrsWithoutClass"
        tabindex="0"
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
          <span class="truncate">{{ selectedOption?.name ?? label }}</span>
        </div>
        <div :class="selectDropdownClass">
          <i
            class="icon-[lucide--chevron-down] size-[1.2em] text-muted-foreground"
          />
        </div>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal :key="Number(isOpen)">
      <ComboboxContent
        position="popper"
        :side-offset="8"
        align="start"
        :style="[optionStyle, contentStyle]"
        :class="cn(selectContentClass, 'min-w-(--reka-combobox-trigger-width)')"
        @keydown="onContentKeydown"
      >
        <FocusScope
          class="contents"
          @mount-auto-focus.prevent
          @unmount-auto-focus.prevent
        >
          <div class="px-2 pt-2">
            <div class="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <i class="icon-[lucide--search] text-muted-foreground" />
              <ComboboxInput
                v-model="searchQuery"
                :aria-label="searchLabel"
                :placeholder="searchPlaceholder"
                class="w-full border-none bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <ComboboxViewport
            :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
            class="scrollbar-custom w-full"
          >
            <ComboboxItem
              v-for="opt in filteredOptions"
              :key="opt.value"
              :value="opt"
              :class="selectItemVariants({ layout: 'single' })"
            >
              <span class="truncate">{{ opt.name }}</span>
              <ComboboxItemIndicator
                class="flex shrink-0 items-center justify-center"
              >
                <i
                  class="icon-[lucide--check] text-foreground"
                  aria-hidden="true"
                />
              </ComboboxItemIndicator>
            </ComboboxItem>
            <ComboboxEmpty :class="selectEmptyMessageClass">
              {{ emptyText }}
            </ComboboxEmpty>
          </ComboboxViewport>
        </FocusScope>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { unrefElement } from '@vueuse/core'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  FocusScope,
  ComboboxPortal
} from 'reka-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import type { StyleValue } from 'vue'

import {
  selectContentClass,
  selectDropdownClass,
  selectEmptyMessageClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@comfyorg/design-system/select.variants'
import type { SelectOption } from '@comfyorg/design-system/lib/select/types'
import { useSelectSearch } from '@comfyorg/design-system/lib/select/useSelectSearch'
import { useAttrsClass } from '@comfyorg/design-system/lib/composables/useAttrsClass'
import { usePopoverSizing } from '@comfyorg/design-system/lib/composables/usePopoverSizing'

defineOptions({ inheritAttrs: false })

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
  searchPlaceholder,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth,
  contentStyle
} = defineProps<{
  label?: string
  accessibleLabel: string
  searchLabel: string
  emptyText: string
  options?: SelectOption<string | number>[]
  size?: 'lg' | 'md'
  invalid?: boolean
  loading?: boolean
  disabled?: boolean
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}>()

const selectedItem = defineModel<string | number | undefined>({
  required: true
})
const triggerRef = useTemplateRef('trigger')
const isOpen = ref(false)
const searchQuery = ref('')
const filteredOptions = useSelectSearch(searchQuery, () => options)
const selectedOption = computed({
  get: () => options.find(({ value }) => value === selectedItem.value),
  set: (option: SelectOption<string | number> | undefined) => {
    selectedItem.value = option?.value
  }
})

watch(isOpen, (open) => {
  if (!open) searchQuery.value = ''
})

function onContentKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    unrefElement(triggerRef)?.focus()
    isOpen.value = false
    return
  }
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
