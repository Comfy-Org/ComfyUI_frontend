<template>
  <WidgetLayoutField :widget>
    <ComboboxRoot
      :open="isOpen"
      :model-value="comboboxValue"
      :disabled
      ignore-filter
      selection-behavior="replace"
      :reset-search-term-on-select="false"
      @update:model-value="selectOption"
      @update:open="handleOpenChange"
    >
      <ComboboxAnchor as-child>
        <div
          data-capture-wheel="true"
          :class="
            cn(
              WidgetInputBaseClass,
              'flex w-full min-w-0 items-center overflow-hidden',
              useWidgetHeight(),
              !disabled && 'hover:bg-component-node-widget-background-hovered',
              disabled && 'opacity-50',
              isInvalid && 'ring-1 ring-destructive-background'
            )
          "
        >
          <ComboboxTrigger as-child>
            <button
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              :aria-label="widget.label || widget.name"
              :aria-invalid="isInvalid || undefined"
              :aria-expanded="isOpen"
              :disabled
              tabindex="0"
              data-testid="widget-select-default-trigger"
              class="flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden border-none bg-transparent p-0 outline-none disabled:cursor-default"
            >
              <span
                class="min-w-[4ch] flex-1 truncate pr-1 pl-2 text-left text-xs"
              >
                {{ selectedLabel || placeholder || '\u00a0' }}
              </span>
            </button>
          </ComboboxTrigger>
          <slot />
          <button
            type="button"
            tabindex="-1"
            aria-hidden="true"
            :disabled
            class="flex h-full w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent outline-none disabled:cursor-default"
            @click="handleOpenChange(true)"
          >
            <i
              :class="
                cn(
                  'icon-[lucide--chevron-down] size-4',
                  disabled
                    ? 'bg-component-node-foreground-secondary'
                    : 'bg-muted-foreground'
                )
              "
              aria-hidden="true"
            />
          </button>
        </div>
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          data-capture-wheel="true"
          data-testid="widget-select-default-overlay"
          position="popper"
          :side-offset="1"
          align="start"
          :class="
            cn(
              'z-3000 overflow-hidden rounded-lg border border-solid border-border-default bg-base-background p-0 text-base-foreground shadow-md',
              'min-w-(--reka-combobox-trigger-width)'
            )
          "
          @keydown.escape.stop="handleOpenChange(false)"
          @focus-outside="handleFocusOutside"
        >
          <div
            v-if="isFilterable"
            ref="searchInputContainerRef"
            class="m-1 flex items-center gap-2 rounded-md border border-solid border-border-default px-2 py-1.5 transition-colors focus-within:border-primary-background"
          >
            <i
              class="icon-[lucide--search] shrink-0 text-sm text-muted-foreground"
              aria-hidden="true"
            />
            <ComboboxInput
              v-model="searchQuery"
              :placeholder="filterPlaceholder"
              auto-focus
              :aria-label="$t('g.search')"
              data-testid="widget-select-default-search-input"
              class="w-full border-none bg-transparent text-xs outline-none"
            />
          </div>

          <div
            data-testid="widget-select-default-viewport"
            role="presentation"
            class="flex max-h-56 min-w-full scrollbar-thin scrollbar-thumb-alpha-smoke-500-50 scrollbar-track-transparent scrollbar-gutter-stable flex-col gap-1 overflow-y-auto p-1 text-xs"
            :style="viewportStyle"
            @pointerdown.capture.self="handleViewportPointerDown"
          >
            <ComboboxItem
              v-for="option in filteredOptions"
              :key="option.key"
              :value="option.comboboxValue"
              :text-value="option.label"
              :class="
                cn(
                  'relative flex min-h-7 cursor-pointer items-center justify-between gap-3 rounded-sm p-2 outline-none select-none',
                  'hover:bg-secondary-background data-highlighted:bg-secondary-background',
                  'data-[state=checked]:bg-primary-background/20 data-[state=checked]:hover:bg-primary-background/20 data-[state=checked]:data-highlighted:bg-primary-background/30'
                )
              "
            >
              <span class="truncate">
                {{ option.label }}
              </span>
              <ComboboxItemIndicator
                class="flex shrink-0 items-center justify-center"
              >
                <i
                  class="icon-[lucide--check] size-3.5 text-base-foreground"
                  aria-hidden="true"
                />
              </ComboboxItemIndicator>
            </ComboboxItem>

            <div
              v-if="filteredOptions.length === 0"
              role="status"
              aria-live="polite"
              class="p-2 text-xs text-muted-foreground"
            >
              {{ $t('g.noResultsFound') }}
            </div>
          </div>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import { useRestoreFocusOnViewportPointer } from '@/renderer/extensions/vueNodes/widgets/composables/useRestoreFocusOnViewportPointer'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
}

interface SelectOption {
  comboboxValue: string
  key: string
  label: string
  value: string
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget } = defineProps<Props>()

// Reka reserves an empty string value for clearing the combobox. Encode values
// internally so custom-node combo options can still use '' like PrimeVue/legacy.
const COMBOBOX_VALUE_PREFIX = 'widget-select-value:'
const MAX_VISIBLE_OPTIONS = 7

function toComboboxValue(value: string) {
  return `${COMBOBOX_VALUE_PREFIX}${value}`
}

function fromComboboxValue(value: string | undefined) {
  if (value === undefined || !value.startsWith(COMBOBOX_VALUE_PREFIX)) {
    return undefined
  }

  return value.slice(COMBOBOX_VALUE_PREFIX.length)
}

function resolveRawValues(values: unknown): unknown[] {
  try {
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? resolved : []
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to resolve options', error)
    return []
  }
}

function resolveValues(values: unknown): string[] {
  return resolveRawValues(values)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
}

const modelValue = defineModel<string | undefined>({
  default(modelProps: Record<string, unknown>) {
    try {
      const modelWidget = modelProps.widget as Props['widget'] | undefined
      const values = modelWidget?.options?.values
      const resolved = typeof values === 'function' ? values() : values
      const firstValue = Array.isArray(resolved)
        ? resolved.find((value) => value !== null && value !== undefined)
        : undefined
      return firstValue === undefined ? '' : String(firstValue)
    } catch (error) {
      console.error('[WidgetSelectDefault] Failed to resolve options', error)
      return ''
    }
  }
})

const searchQuery = ref('')
const optionsRefreshKey = ref(0)
const isOpen = ref(false)
const searchInputContainerRef = ref<HTMLElement>()
const { handleFocusOutside, handleViewportPointerDown } =
  useRestoreFocusOnViewportPointer(focusSearchInput)

const widgetOptions = computed(
  () => widget.options as SelectWidgetOptions | undefined
)

const disabled = computed(() => Boolean(widgetOptions.value?.disabled))
const placeholder = computed(() => widgetOptions.value?.placeholder ?? '')
const filterPlaceholder = computed(
  () => widgetOptions.value?.filterPlaceholder ?? placeholder.value
)

function refreshOptions() {
  optionsRefreshKey.value++
}

function getOptionLabel(value: string) {
  const labeler = widgetOptions.value?.getOptionLabel
  if (!labeler) return value

  try {
    return labeler(value) || value
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to map option label', error)
    return value
  }
}

const normalizedOptions = computed<SelectOption[]>(() => {
  void optionsRefreshKey.value

  return resolveValues(widgetOptions.value?.values).map((value, index) => ({
    comboboxValue: toComboboxValue(value),
    key: `${value}-${index}`,
    label: getOptionLabel(value),
    value
  }))
})

const knownOptionValues = computed(
  () => new Set(normalizedOptions.value.map((option) => option.value))
)

const isFilterable = computed(() => normalizedOptions.value.length > 4)

const filteredOptions = computed(() => {
  if (!isFilterable.value) return normalizedOptions.value

  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return normalizedOptions.value

  return normalizedOptions.value.filter(
    (option) =>
      option.value.toLocaleLowerCase().includes(query) ||
      option.label.toLocaleLowerCase().includes(query)
  )
})

const viewportStyle = computed<CSSProperties>(() => ({
  overflowY:
    filteredOptions.value.length > MAX_VISIBLE_OPTIONS ? 'scroll' : 'auto',
  scrollbarGutter: 'stable'
}))

const selectedOption = computed(() =>
  normalizedOptions.value.find((option) => option.value === modelValue.value)
)

const comboboxValue = computed(() => {
  const value = modelValue.value
  if (value === undefined || !knownOptionValues.value.has(value)) return ''

  return toComboboxValue(value)
})

const isInvalid = computed(
  () =>
    modelValue.value !== undefined &&
    modelValue.value !== '' &&
    !selectedOption.value
)

const selectedLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label
  if (isInvalid.value) return String(modelValue.value)
  return ''
})

function selectOption(rekaValue: string | undefined) {
  const value = fromComboboxValue(rekaValue)
  if (value === undefined || !knownOptionValues.value.has(value)) return

  modelValue.value = value
  searchQuery.value = ''
  isOpen.value = false
}

function focusSearchInput() {
  const input =
    searchInputContainerRef.value?.querySelector<HTMLInputElement>('input')
  if (!input) return false

  input.focus({ preventScroll: true })
  return true
}

function handleOpenChange(open: boolean) {
  isOpen.value = open

  if (open) {
    refreshOptions()
  } else {
    searchQuery.value = ''
  }
}
</script>
